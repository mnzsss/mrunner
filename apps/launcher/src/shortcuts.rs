use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

// State management for registered global shortcuts
pub struct RegisteredShortcuts {
    pub registered: Vec<String>,
}

// Shortcut configuration from frontend
#[derive(serde::Deserialize)]
pub struct ShortcutConfig {
    #[allow(dead_code)]
    pub id: String,
    pub hotkey: String,
    pub action: String,
}

#[tauri::command]
pub fn sync_global_shortcuts(
    app: tauri::AppHandle,
    shortcuts: Vec<ShortcutConfig>,
) -> Result<(), String> {
    println!("[shortcuts] sync_global_shortcuts called with {} shortcuts", shortcuts.len());

    let state = app.state::<Mutex<RegisteredShortcuts>>();
    let mut state = state.lock().map_err(|e| format!("Failed to lock state: {}", e))?;

    // Unregister all existing shortcuts
    for shortcut_str in &state.registered {
        println!("[shortcuts] Unregistering: {}", shortcut_str);
        if let Ok(shortcut) = shortcut_str.parse::<Shortcut>() {
            let _ = app.global_shortcut().unregister(shortcut);
        }
    }
    state.registered.clear();

    // Register new shortcuts
    for sc in &shortcuts {
        println!("[shortcuts] Registering: {} -> {}", sc.hotkey, sc.action);

        match sc.hotkey.parse::<Shortcut>() {
            Ok(shortcut) => {
                let action = sc.action.clone();

                if let Err(e) = app.global_shortcut()
                    .on_shortcut(shortcut.clone(), move |app, _shortcut, event| {
                        // Only handle pressed events to avoid double triggers
                        if event.state != ShortcutState::Pressed {
                            return;
                        }

                        match action.as_str() {
                            "toggle-window" => {
                                if let Some(window) = app.get_webview_window("main") {
                                    if window.is_visible().unwrap_or(false) {
                                        let _ = window.hide();
                                    } else {
                                        let _ = window.center();
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                    }
                                }
                            }
                            _ => {}
                        }
                    }) {
                    println!("[shortcuts] Failed to register {}: {}", sc.hotkey, e);
                    return Err(format!("Failed to register shortcut '{}': {}", sc.hotkey, e));
                }

                state.registered.push(sc.hotkey.clone());
                println!("[shortcuts] Registered successfully: {}", sc.hotkey);
            }
            Err(e) => {
                println!("[shortcuts] Failed to parse hotkey '{}': {}", sc.hotkey, e);
                return Err(format!("Invalid hotkey format '{}': {}", sc.hotkey, e));
            }
        }
    }

    println!("[shortcuts] All shortcuts registered successfully");
    Ok(())
}

// Load shortcuts from saved preferences file on startup
pub fn load_saved_shortcuts(app: &tauri::AppHandle) -> Result<(), String> {
    use std::fs;

    let home = std::env::var("HOME").map_err(|e| e.to_string())?;

    // Check both dev and prod config directories
    let config_paths = vec![
        format!("{}/.config/mrunner-dev/preferences.json", home),
        format!("{}/.config/mrunner/preferences.json", home),
    ];

    let mut config_content = None;
    for path in &config_paths {
        if let Ok(content) = fs::read_to_string(path) {
            println!("[shortcuts] Found config at: {}", path);
            config_content = Some(content);
            break;
        }
    }

    let content = config_content.ok_or("No preferences file found")?;
    let json: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    // Extract shortcuts from preferences
    let shortcuts = json.get("shortcuts")
        .and_then(|s| s.get("shortcuts"))
        .and_then(|s| s.as_array())
        .ok_or("No shortcuts found in preferences")?;

    let state = app.state::<Mutex<RegisteredShortcuts>>();
    let mut state = state.lock().map_err(|e| format!("Failed to lock state: {}", e))?;

    for sc in shortcuts {
        let enabled = sc.get("enabled").and_then(|e| e.as_bool()).unwrap_or(true);
        let sc_type = sc.get("type").and_then(|t| t.as_str()).unwrap_or("");

        // Only register global shortcuts that are enabled
        if sc_type != "global" || !enabled {
            continue;
        }

        let hotkey_obj = sc.get("hotkey").ok_or("Missing hotkey")?;
        let modifiers = hotkey_obj.get("modifiers")
            .and_then(|m| m.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>())
            .unwrap_or_default();
        let key = hotkey_obj.get("key").and_then(|k| k.as_str()).unwrap_or("");

        // Build hotkey string: "Control+Shift+P"
        let mut hotkey_parts = modifiers.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        hotkey_parts.push(key.to_string());
        let hotkey_str = hotkey_parts.join("+");

        let action = sc.get("action").and_then(|a| a.as_str()).unwrap_or("").to_string();

        println!("[shortcuts] Loading saved shortcut: {} -> {}", hotkey_str, action);

        if let Ok(shortcut) = hotkey_str.parse::<Shortcut>() {
            let action_clone = action.clone();

            if let Err(e) = app.global_shortcut()
                .on_shortcut(shortcut.clone(), move |app, _shortcut, event| {
                    if event.state != ShortcutState::Pressed {
                        return;
                    }

                    match action_clone.as_str() {
                        "toggle-window" => {
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.center();
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                        _ => {}
                    }
                }) {
                println!("[shortcuts] Failed to register {}: {}", hotkey_str, e);
            } else {
                state.registered.push(hotkey_str.clone());
                println!("[shortcuts] Registered: {}", hotkey_str);
            }
        } else {
            println!("[shortcuts] Failed to parse hotkey: {}", hotkey_str);
        }
    }

    Ok(())
}
