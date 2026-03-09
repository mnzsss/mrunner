use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

#[derive(Debug, Deserialize)]
struct PluginManifest {
    id: String,
    name: String,
    icon: Option<String>,
    runtime: String,
}

#[derive(Debug, Deserialize)]
struct PluginManifestFull {
    id: String,
    name: String,
    version: Option<String>,
    description: Option<String>,
    author: Option<String>,
    icon: Option<String>,
    runtime: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginPreviewInfo {
    pub id: String,
    pub name: String,
    pub version: Option<String>,
    pub description: Option<String>,
    pub author: Option<String>,
    pub icon: Option<String>,
    pub runtime: String,
    pub temp_path: String,
}

#[derive(Debug, Deserialize)]
struct CommandConfig {
    title: String,
    description: Option<String>,
    icon: Option<String>,
    mode: Option<String>,
    keywords: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PluginTier {
    Json,
    Scriptable,
    Native,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CommandMode {
    List,
    Detail,
    Action,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisteredCommand {
    pub id: String,
    pub title: String,
    pub description: String,
    pub icon: String,
    pub mode: CommandMode,
    pub keywords: Vec<String>,
    pub script_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisteredPlugin {
    pub plugin_id: String,
    pub plugin_name: String,
    pub plugin_icon: String,
    pub runtime: String,
    pub commands: Vec<RegisteredCommand>,
    pub tier: PluginTier,
    pub plugin_dir: PathBuf,
}

pub fn discover_plugins() -> Vec<RegisteredPlugin> {
    let plugins_dir = match dirs::config_dir() {
        Some(d) => d.join("mrunner").join("plugins"),
        None => {
            eprintln!("[plugins] Could not determine config directory");
            return vec![];
        }
    };

    if !plugins_dir.exists() {
        return vec![];
    }

    let entries = match std::fs::read_dir(&plugins_dir) {
        Ok(e) => e,
        Err(err) => {
            eprintln!("[plugins] Failed to read plugins dir: {}", err);
            return vec![];
        }
    };

    let mut plugins = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();

        if path.is_dir() {
            let manifest_path = path.join("plugin.json");
            if manifest_path.exists() {
                if let Some(plugin) = load_scriptable_plugin(&path, &manifest_path) {
                    plugins.push(plugin);
                }
            }
        }
    }

    plugins
}

fn load_scriptable_plugin(plugin_dir: &PathBuf, manifest_path: &PathBuf) -> Option<RegisteredPlugin> {
    let manifest_str = match std::fs::read_to_string(manifest_path) {
        Ok(s) => s,
        Err(err) => {
            eprintln!("[plugins] Failed to read {:?}: {}", manifest_path, err);
            return None;
        }
    };

    let manifest: PluginManifest = match serde_json::from_str(&manifest_str) {
        Ok(m) => m,
        Err(err) => {
            eprintln!("[plugins] Failed to parse {:?}: {}", manifest_path, err);
            return None;
        }
    };

    let commands_dir = plugin_dir.join("src").join("commands");
    let commands = if commands_dir.exists() {
        load_commands(&manifest.id, &commands_dir)
    } else {
        vec![]
    };

    Some(RegisteredPlugin {
        plugin_id: manifest.id,
        plugin_name: manifest.name,
        plugin_icon: manifest.icon.unwrap_or_default(),
        runtime: manifest.runtime,
        commands,
        tier: PluginTier::Scriptable,
        plugin_dir: plugin_dir.clone(),
    })
}

fn load_commands(plugin_id: &str, commands_dir: &PathBuf) -> Vec<RegisteredCommand> {
    let entries = match std::fs::read_dir(commands_dir) {
        Ok(e) => e,
        Err(err) => {
            eprintln!("[plugins] Failed to read commands dir {:?}: {}", commands_dir, err);
            return vec![];
        }
    };

    let mut commands = Vec::new();

    for entry in entries.flatten() {
        let cmd_dir = entry.path();
        if !cmd_dir.is_dir() {
            continue;
        }

        let config_path = cmd_dir.join("config.json");
        if !config_path.exists() {
            continue;
        }

        let config_str = match std::fs::read_to_string(&config_path) {
            Ok(s) => s,
            Err(err) => {
                eprintln!("[plugins] Failed to read {:?}: {}", config_path, err);
                continue;
            }
        };

        let config: CommandConfig = match serde_json::from_str(&config_str) {
            Ok(c) => c,
            Err(err) => {
                eprintln!("[plugins] Failed to parse {:?}: {}", config_path, err);
                continue;
            }
        };

        let cmd_name = match cmd_dir.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        let mode = match config.mode.as_deref() {
            Some("detail") => CommandMode::Detail,
            Some("action") => CommandMode::Action,
            _ => CommandMode::List,
        };

        commands.push(RegisteredCommand {
            id: format!("{}:{}", plugin_id, cmd_name),
            title: config.title,
            description: config.description.unwrap_or_default(),
            icon: config.icon.unwrap_or_default(),
            mode,
            keywords: config.keywords.unwrap_or_default(),
            script_path: Some(cmd_dir.join("command.ts")),
        });
    }

    commands
}

pub fn find_command<'a>(
    plugins: &'a [RegisteredPlugin],
    command_id: &str,
) -> Option<(&'a RegisteredPlugin, &'a RegisteredCommand)> {
    for plugin in plugins {
        for command in &plugin.commands {
            if command.id == command_id {
                return Some((plugin, command));
            }
        }
    }
    None
}

fn resolve_runner_path(plugin_dir: &PathBuf) -> Result<PathBuf, String> {
    let local = plugin_dir
        .join("node_modules")
        .join("@mrunner")
        .join("plugin")
        .join("dist")
        .join("runner.js");
    if local.exists() {
        return Ok(local);
    }
    Err(format!(
        "runner.js not found at {:?} — run `npm install` inside the plugin directory",
        local
    ))
}

pub async fn run_plugin_command(
    plugin: &RegisteredPlugin,
    command: &RegisteredCommand,
    context: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let runner_path = resolve_runner_path(&plugin.plugin_dir)?;
    let script_path = command
        .script_path
        .as_ref()
        .ok_or_else(|| format!("Plugin command '{}' has no script_path (native commands are not executed here)", command.id))?;
    let context_json = serde_json::to_string(&context).map_err(|e| e.to_string())?;

    let mut child = tokio::process::Command::new(&plugin.runtime)
        .arg(&runner_path)
        .arg(script_path)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn {} process: {}", plugin.runtime, e))?;

    // Write context JSON to stdin and close it
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(context_json.as_bytes())
            .await
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
    }

    // Extract stdout/stderr handles, then spawn concurrent tasks (both run while timeout is active)
    let mut stdout_handle = child.stdout.take().expect("stdout was piped");
    let mut stderr_handle = child.stderr.take().expect("stderr was piped");

    let stdout_task = tokio::spawn(async move {
        let mut buf = Vec::new();
        stdout_handle.read_to_end(&mut buf).await.ok();
        buf
    });
    let stderr_task = tokio::spawn(async move {
        let mut buf = Vec::new();
        stderr_handle.read_to_end(&mut buf).await.ok();
        buf
    });

    let read_future = async {
        let stdout_buf = stdout_task.await.unwrap_or_default();
        let stderr_buf = stderr_task.await.unwrap_or_default();
        (stdout_buf, stderr_buf)
    };

    let timeout_result = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        read_future,
    )
    .await;

    match timeout_result {
        Err(_) => {
            let _ = child.kill().await;
            Err(format!("Plugin command '{}' timed out after 10 seconds", command.id))
        }
        Ok((stdout_buf, stderr_buf)) => {
            let status = child
                .wait()
                .await
                .map_err(|e| format!("Failed to wait for process: {}", e))?;

            if !status.success() {
                let stderr = String::from_utf8_lossy(&stderr_buf).to_string();
                return Err(format!(
                    "Plugin command '{}' exited with status {}: {}",
                    command.id,
                    status.code().unwrap_or(-1),
                    stderr
                ));
            }
            let stdout = String::from_utf8_lossy(&stdout_buf);
            serde_json::from_str::<serde_json::Value>(stdout.trim())
                .map_err(|e| format!("Failed to parse plugin output as JSON: {}", e))
        }
    }
}

/// Clones the repository to a temporary directory inside the plugins folder and
/// returns a preview of the plugin manifest so the user can confirm before installation.
pub fn prepare_plugin_install(git_url: &str) -> Result<PluginPreviewInfo, String> {
    let plugins_base = dirs::config_dir()
        .ok_or("Could not find config directory")?
        .join("mrunner")
        .join("plugins");

    std::fs::create_dir_all(&plugins_base)
        .map_err(|e| format!("Failed to create plugins directory: {}", e))?;

    // Unique temp dir on the same filesystem to avoid cross-device rename later
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let temp_dir = plugins_base.join(format!(".installing-{}", ts));

    let status = std::process::Command::new("git")
        .arg("clone")
        .arg(git_url)
        .arg(&temp_dir)
        .status()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if !status.success() {
        let _ = std::fs::remove_dir_all(&temp_dir);
        return Err(format!("git clone failed for URL: {}", git_url));
    }

    let manifest_path = temp_dir.join("plugin.json");
    if !manifest_path.exists() {
        let _ = std::fs::remove_dir_all(&temp_dir);
        return Err("No plugin.json found in the repository root".to_string());
    }

    let content = std::fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read plugin.json: {}", e))?;

    let manifest: PluginManifestFull = serde_json::from_str(&content).map_err(|e| {
        let _ = std::fs::remove_dir_all(&temp_dir);
        format!("Invalid plugin.json: {}", e)
    })?;

    Ok(PluginPreviewInfo {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        icon: manifest.icon,
        runtime: manifest.runtime,
        temp_path: temp_dir.to_string_lossy().to_string(),
    })
}

/// Moves the previously cloned temp directory to its final location and runs npm install.
pub fn complete_plugin_install(temp_path: &str) -> Result<(), String> {
    let temp_dir = PathBuf::from(temp_path);

    let manifest_path = temp_dir.join("plugin.json");
    let content = std::fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read plugin.json: {}", e))?;
    let manifest: PluginManifest = serde_json::from_str(&content)
        .map_err(|e| format!("Invalid plugin.json: {}", e))?;

    let final_dir = dirs::config_dir()
        .ok_or("Could not find config directory")?
        .join("mrunner")
        .join("plugins")
        .join(&manifest.id);

    if final_dir.exists() {
        let _ = std::fs::remove_dir_all(&temp_dir);
        return Err(format!("Plugin '{}' is already installed", manifest.id));
    }

    std::fs::rename(&temp_dir, &final_dir).map_err(|e| {
        let _ = std::fs::remove_dir_all(&temp_dir);
        format!("Failed to move plugin directory: {}", e)
    })?;

    if final_dir.join("package.json").exists() {
        let status = std::process::Command::new("npm")
            .arg("install")
            .current_dir(&final_dir)
            .status()
            .map_err(|e| {
                let _ = std::fs::remove_dir_all(&final_dir);
                format!("Failed to run npm install: {}", e)
            })?;

        if !status.success() {
            let _ = std::fs::remove_dir_all(&final_dir);
            return Err("npm install failed".to_string());
        }
    }

    Ok(())
}

/// Cleans up a temporary install directory (used when the user cancels).
pub fn cancel_plugin_install(temp_path: &str) {
    let _ = std::fs::remove_dir_all(temp_path);
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateResult {
    pub plugin_id: String,
    pub plugin_name: String,
    pub status: String,
    pub message: Option<String>,
}

/// Runs `git pull` in each installed Tier 2 plugin directory. Re-runs npm install
/// if the pull brought in changes. Returns one UpdateResult per plugin.
pub fn check_plugin_updates(plugins: &[RegisteredPlugin]) -> Vec<UpdateResult> {
    let mut results = Vec::new();

    for plugin in plugins {
        if !matches!(plugin.tier, PluginTier::Scriptable) {
            continue;
        }

        let dir = &plugin.plugin_dir;

        let git_dir = dir.join(".git");
        if !git_dir.exists() {
            results.push(UpdateResult {
                plugin_id: plugin.plugin_id.clone(),
                plugin_name: plugin.plugin_name.clone(),
                status: "skipped".to_string(),
                message: Some("Not a git repository".to_string()),
            });
            continue;
        }

        let output = match std::process::Command::new("git")
            .arg("-C")
            .arg(dir)
            .arg("pull")
            .output()
        {
            Ok(o) => o,
            Err(e) => {
                results.push(UpdateResult {
                    plugin_id: plugin.plugin_id.clone(),
                    plugin_name: plugin.plugin_name.clone(),
                    status: "error".to_string(),
                    message: Some(format!("Failed to run git: {}", e)),
                });
                continue;
            }
        };

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if !output.status.success() {
            results.push(UpdateResult {
                plugin_id: plugin.plugin_id.clone(),
                plugin_name: plugin.plugin_name.clone(),
                status: "error".to_string(),
                message: Some(stderr),
            });
            continue;
        }

        let updated = !stdout.contains("Already up to date");

        // Re-run npm install if there were changes and package.json exists
        if updated && dir.join("package.json").exists() {
            let npm_status = std::process::Command::new("npm")
                .arg("install")
                .current_dir(dir)
                .status();

            if let Err(e) = npm_status {
                results.push(UpdateResult {
                    plugin_id: plugin.plugin_id.clone(),
                    plugin_name: plugin.plugin_name.clone(),
                    status: "error".to_string(),
                    message: Some(format!("Updated but npm install failed: {}", e)),
                });
                continue;
            }
        }

        results.push(UpdateResult {
            plugin_id: plugin.plugin_id.clone(),
            plugin_name: plugin.plugin_name.clone(),
            status: if updated { "updated" } else { "up-to-date" }.to_string(),
            message: None,
        });
    }

    results
}
