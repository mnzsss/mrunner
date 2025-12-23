mod buku;

use std::process::Command;
use tauri::Manager;

const ALLOWED_COMMANDS: &[&str] = &[
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "firefox",
    "brave",
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

    let parts: Vec<&str> = command.split_whitespace().collect();
    if parts.is_empty() {
        return Err("Empty command".to_string());
    }

    let executable = parts[0];
    let args = &parts[1..];

    let output = Command::new(executable)
        .args(args)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
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
            buku::buku_list,
            buku::buku_search,
            buku::buku_get_by_id,
            buku::buku_open,
            buku::buku_add,
            buku::buku_update,
            buku::buku_delete,
            buku::buku_list_tags,
            buku::buku_rename_tag,
            buku::buku_delete_tag,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
