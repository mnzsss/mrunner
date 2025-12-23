mod bookmarks;
mod chrome;
mod platform;

use std::process::Command;
use tauri::Manager;

fn is_command_allowed(cmd: &str) -> bool {
    let executable = cmd.split_whitespace().next().unwrap_or("");
    let base_name = executable.rsplit('/').next().unwrap_or(executable);

    // Windows: also strip .exe extension
    #[cfg(target_os = "windows")]
    let base_name = base_name.strip_suffix(".exe").unwrap_or(base_name);

    platform::get_allowed_commands().contains(&base_name)
}

#[tauri::command]
fn run_shell_command(command: &str) -> Result<String, String> {
    println!("[DEBUG] run_shell_command called with: {}", command);

    if !is_command_allowed(command) {
        println!("[DEBUG] Command not allowed: {}", command);
        return Err(format!(
            "Command not allowed. Only these executables are permitted: {:?}",
            platform::get_allowed_commands()
        ));
    }

    let parts = shell_words::split(command).map_err(|e| e.to_string())?;
    if parts.is_empty() {
        return Err("Empty command".to_string());
    }

    let executable = &parts[0];
    let args: Vec<String> = parts[1..]
        .iter()
        .map(|arg| platform::expand_path(arg))
        .collect();

    Command::new(executable)
        .args(&args)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok("Process started".to_string())
}

#[tauri::command]
fn get_platform_info() -> platform::PlatformInfo {
    platform::get_platform_info()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
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
            get_platform_info,
            chrome::list_chrome_profiles,
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
