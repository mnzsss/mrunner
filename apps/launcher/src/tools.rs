use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{Emitter, State};

#[derive(Serialize)]
pub struct ToolStatus {
    pub installed: bool,
    pub path: Option<String>,
}

pub struct AiProcessState(pub Mutex<Option<Child>>);

#[tauri::command]
pub fn check_tool_installed(tool_id: String) -> Result<ToolStatus, String> {
    let check_cmd = match tool_id.as_str() {
        "codex" => {
            #[cfg(target_os = "windows")]
            {
                "where codex"
            }
            #[cfg(not(target_os = "windows"))]
            {
                "which codex"
            }
        }
        "claude" => {
            #[cfg(target_os = "windows")]
            {
                "where claude"
            }
            #[cfg(not(target_os = "windows"))]
            {
                "which claude"
            }
        }
        _ => return Err(format!("Unknown tool: {}", tool_id)),
    };

    let parts: Vec<&str> = check_cmd.split_whitespace().collect();
    let output = Command::new(parts[0]).args(&parts[1..]).output();

    match output {
        Ok(out) if out.status.success() => {
            let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
            Ok(ToolStatus {
                installed: true,
                path: Some(path),
            })
        }
        _ => Ok(ToolStatus {
            installed: false,
            path: None,
        }),
    }
}

// --- Model listing ---

#[derive(Serialize, Clone)]
pub struct CodexReasoningLevel {
    pub effort: String,
    pub description: String,
}

#[derive(Serialize, Clone)]
pub struct CodexModel {
    pub slug: String,
    pub display_name: String,
    pub description: String,
    pub default_reasoning_level: String,
    pub supported_reasoning_levels: Vec<CodexReasoningLevel>,
}

#[derive(Deserialize)]
struct ModelsCache {
    models: Vec<ModelEntry>,
}

#[derive(Deserialize)]
struct ModelEntry {
    slug: String,
    display_name: Option<String>,
    description: Option<String>,
    default_reasoning_level: Option<String>,
    supported_reasoning_levels: Option<Vec<ReasoningEntry>>,
    visibility: Option<String>,
}

#[derive(Deserialize)]
struct ReasoningEntry {
    effort: String,
    description: Option<String>,
}

#[tauri::command]
pub fn list_codex_models() -> Result<Vec<CodexModel>, String> {
    let home = dirs::home_dir().ok_or("Could not determine home directory")?;
    let cache_path = home.join(".codex").join("models_cache.json");

    if !cache_path.exists() {
        return Ok(vec![]);
    }

    let content =
        std::fs::read_to_string(&cache_path).map_err(|e| format!("Failed to read cache: {}", e))?;
    let cache: ModelsCache =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse cache: {}", e))?;

    let models = cache
        .models
        .into_iter()
        .filter(|m| m.visibility.as_deref() == Some("list"))
        .map(|m| CodexModel {
            display_name: m.display_name.unwrap_or_else(|| m.slug.clone()),
            description: m.description.unwrap_or_default(),
            default_reasoning_level: m.default_reasoning_level.unwrap_or_default(),
            supported_reasoning_levels: m
                .supported_reasoning_levels
                .unwrap_or_default()
                .into_iter()
                .map(|r| CodexReasoningLevel {
                    effort: r.effort,
                    description: r.description.unwrap_or_default(),
                })
                .collect(),
            slug: m.slug,
        })
        .collect();

    Ok(models)
}

// --- AI message handling ---

#[derive(Serialize, Clone)]
struct CodexItemEvent {
    id: String,
    item_type: String,
    text: Option<String>,
    command: Option<String>,
    aggregated_output: Option<String>,
    exit_code: Option<i64>,
    status: Option<String>,
}

#[derive(Serialize, Clone)]
struct CodexTurnCompleted {
    input_tokens: u64,
    cached_input_tokens: u64,
    output_tokens: u64,
}

fn extract_item_event(item: &Value) -> Option<CodexItemEvent> {
    Some(CodexItemEvent {
        id: item.get("id")?.as_str()?.to_string(),
        item_type: item.get("type")?.as_str()?.to_string(),
        text: item.get("text").and_then(|v| v.as_str()).map(String::from),
        command: item.get("command").and_then(|v| v.as_str()).map(String::from),
        aggregated_output: item
            .get("aggregated_output")
            .and_then(|v| v.as_str())
            .map(String::from),
        exit_code: item.get("exit_code").and_then(|v| v.as_i64()),
        status: item.get("status").and_then(|v| v.as_str()).map(String::from),
    })
}

fn extract_usage(event: &Value) -> CodexTurnCompleted {
    let usage = event.get("usage").cloned().unwrap_or(Value::Null);
    CodexTurnCompleted {
        input_tokens: usage
            .get("input_tokens")
            .and_then(|v| v.as_u64())
            .unwrap_or(0),
        cached_input_tokens: usage
            .get("cached_input_tokens")
            .and_then(|v| v.as_u64())
            .unwrap_or(0),
        output_tokens: usage
            .get("output_tokens")
            .and_then(|v| v.as_u64())
            .unwrap_or(0),
    }
}

#[tauri::command]
pub fn send_ai_message(
    message: String,
    model: Option<String>,
    reasoning_effort: Option<String>,
    app: tauri::AppHandle,
    state: State<'_, AiProcessState>,
) -> Result<(), String> {
    // Kill any existing process
    if let Ok(mut guard) = state.0.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
        }
    }

    let mut cmd = Command::new("codex");
    cmd.arg("exec").arg("--json");

    if let Some(ref m) = model {
        if !m.is_empty() {
            cmd.arg("--model").arg(m);
        }
    }

    if let Some(ref effort) = reasoning_effort {
        if !effort.is_empty() {
            cmd.arg("-c").arg(format!("model_reasoning_effort=\"{}\"", effort));
        }
    }

    cmd.arg(&message);

    let mut child = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start codex: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;

    // Store child process handle for cancellation
    if let Ok(mut guard) = state.0.lock() {
        *guard = Some(child);
    }

    let app_handle = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            match line {
                Ok(text) => {
                    let text = text.trim().to_string();
                    if text.is_empty() {
                        continue;
                    }

                    let event: Value = match serde_json::from_str(&text) {
                        Ok(v) => v,
                        Err(_) => {
                            let _ = app_handle.emit("ai-chat-chunk", &text);
                            continue;
                        }
                    };

                    let event_type = event
                        .get("type")
                        .and_then(|t| t.as_str())
                        .unwrap_or("");

                    match event_type {
                        "item.started" | "item.completed" => {
                            if let Some(item) = event.get("item") {
                                if let Some(payload) = extract_item_event(item) {
                                    let tauri_event = if event_type == "item.started" {
                                        "ai-event-item-started"
                                    } else {
                                        "ai-event-item-completed"
                                    };
                                    let _ = app_handle.emit(tauri_event, &payload);
                                }
                            }
                        }
                        "turn.completed" => {
                            let usage = extract_usage(&event);
                            let _ = app_handle.emit("ai-event-turn-completed", &usage);
                        }
                        _ => {}
                    }
                }
                Err(e) => {
                    let _ = app_handle.emit("ai-chat-error", e.to_string());
                    break;
                }
            }
        }
        let _ = app_handle.emit("ai-chat-done", ());
    });

    Ok(())
}

#[tauri::command]
pub fn cancel_ai_message(state: State<'_, AiProcessState>) -> Result<(), String> {
    if let Ok(mut guard) = state.0.lock() {
        if let Some(mut child) = guard.take() {
            child
                .kill()
                .map_err(|e| format!("Failed to kill process: {}", e))?;
        }
    }
    Ok(())
}
