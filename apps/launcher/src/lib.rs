mod bookmarks;
mod chrome;
mod platform;
mod shortcuts;

use std::process::Command;
use std::sync::Mutex;
use tauri::{
    Manager,
    menu::{Menu, MenuItem, CheckMenuItem, PredefinedMenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_autostart::MacosLauncher;

use shortcuts::{load_saved_shortcuts, RegisteredShortcuts};

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

#[tauri::command]
fn get_user_directories() -> Vec<platform::UserDirectory> {
    platform::get_user_directories()
}

#[tauri::command]
fn is_autostart_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch()
        .is_enabled()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_autostart(app: tauri::AppHandle, enable: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    let autostart_manager = app.autolaunch();
    if enable {
        autostart_manager.enable().map_err(|e| e.to_string())
    } else {
        autostart_manager.disable().map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn open_settings(app: tauri::AppHandle) -> Result<(), String> {
    println!("[settings] open_settings called");
    match app.get_webview_window("settings") {
        Some(window) => {
            println!("[settings] Window found, showing...");
            window.show().map_err(|e| {
                println!("[settings] Error showing: {}", e);
                e.to_string()
            })?;
            window.set_focus().map_err(|e| {
                println!("[settings] Error focus: {}", e);
                e.to_string()
            })?;
            println!("[settings] Window shown successfully");
        }
        None => {
            println!("[settings] Window 'settings' not found!");
            return Err("Settings window not found".to_string());
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(RegisteredShortcuts {
            registered: vec![],
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--flag1", "--flag2"]),
        ))
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("main window not found");

            let _ = window.set_decorations(false);
            let _ = window.set_always_on_top(true);
            let _ = window.set_skip_taskbar(true);
            let _ = window.center();

            // Prevent settings window from being destroyed on close - just hide and return to main
            if let Some(settings_window) = app.get_webview_window("settings") {
                let sw = settings_window.clone();
                let main_win = app.get_webview_window("main");
                settings_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = sw.hide();
                        if let Some(ref mw) = main_win {
                            let _ = mw.show();
                            let _ = mw.set_focus();
                        }
                    }
                });
            }

            // Configurar system tray
            use tauri_plugin_autostart::ManagerExt;
            let autostart_enabled = app.autolaunch().is_enabled().unwrap_or(false);
            
            let show_i = MenuItem::with_id(app, "show", "Mostrar MRunner", true, None::<&str>)?;
            let settings_i = MenuItem::with_id(app, "settings", "Configurações", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let autostart_i = CheckMenuItem::with_id(app, "autostart", "Iniciar com o sistema", true, autostart_enabled, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
            
            let menu = Menu::with_items(app, &[&show_i, &settings_i, &separator, &autostart_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .icon(app.default_window_icon().unwrap().clone())
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "settings" => {
                        if let Some(window) = app.get_webview_window("settings") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    "autostart" => {
                        // Toggle autostart
                        use tauri_plugin_autostart::ManagerExt;
                        let autostart_manager = app.autolaunch();
                        let new_state = if autostart_manager.is_enabled().unwrap_or(false) {
                            let _ = autostart_manager.disable();
                            false
                        } else {
                            let _ = autostart_manager.enable();
                            true
                        };
                        
                        // Update checkbox state
                        if let Some(item) = app.menu().unwrap().get("autostart") {
                            if let Some(check_item) = item.as_check_menuitem() {
                                let _ = check_item.set_checked(new_state);
                            }
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button, button_state, .. } = event {
                        if button == tauri::tray::MouseButton::Left
                            && button_state == tauri::tray::MouseButtonState::Up
                        {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                    }
                })
                .build(app)?;

            // Load saved shortcuts from preferences on startup
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                if let Err(e) = load_saved_shortcuts(&app_handle) {
                    println!("[shortcuts] Failed to load saved shortcuts: {}", e);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            run_shell_command,
            get_platform_info,
            get_user_directories,
            is_autostart_enabled,
            toggle_autostart,
            open_settings,
            shortcuts::sync_global_shortcuts,
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
