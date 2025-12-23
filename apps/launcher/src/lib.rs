mod bookmarks;

use std::env;
use std::process::Command;
use tauri::Manager;

fn expand_tilde(path: &str) -> String {
    if path == "~" {
        env::var("HOME").unwrap_or_else(|_| path.to_string())
    } else if let Some(rest) = path.strip_prefix("~/") {
        match env::var("HOME") {
            Ok(home) => format!("{}/{}", home, rest),
            Err(_) => path.to_string(),
        }
    } else {
        path.to_string()
    }
}

const ALLOWED_COMMANDS: &[&str] = &[
    "google-chrome-stable",
    "nautilus",
    "dolphin",
    "thunar",
    "nemo",
    "pcmanfm",
    "xdg-open",
    "open",
    "code",
    "cursor",
];

fn is_command_allowed(cmd: &str) -> bool {
    let executable = cmd.split_whitespace().next().unwrap_or("");
    let base_name = executable.rsplit('/').next().unwrap_or(executable);
    ALLOWED_COMMANDS.contains(&base_name)
}

#[tauri::command]
fn run_shell_command(command: &str) -> Result<String, String> {
    if !is_command_allowed(command) {
        return Err(format!(
            "Command not allowed. Only these executables are permitted: {:?}",
            ALLOWED_COMMANDS
        ));
    }

    let parts = shell_words::split(command).map_err(|e| e.to_string())?;
    if parts.is_empty() {
        return Err("Empty command".to_string());
    }

    let executable = &parts[0];
    let args: Vec<String> = parts[1..].iter().map(|arg| expand_tilde(arg)).collect();

    Command::new(executable)
        .args(&args)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok("Process started".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("main window not found");

            let _ = window.set_decorations(false);
            let _ = window.set_always_on_top(true);
            let _ = window.set_skip_taskbar(true);
            let _ = window.center();

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            run_shell_command,
            bookmarks::bookmark_list,
            bookmarks::bookmark_search,
            bookmarks::bookmark_get_by_id,
            bookmarks::bookmark_open,
            bookmarks::bookmark_add,
            bookmarks::bookmark_update,
            bookmarks::bookmark_delete,
            bookmarks::bookmark_list_tags,
            bookmarks::bookmark_rename_tag,
            bookmarks::bookmark_delete_tag,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
