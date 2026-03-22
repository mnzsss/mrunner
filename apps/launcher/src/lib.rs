mod bookmarks;
mod chrome;
pub mod github;
mod platform;
pub mod plugins;
mod shortcuts;
mod tools;

use std::process::Command;
use std::sync::Mutex;
use tauri::{
    Emitter,
    Manager,
    menu::{Menu, MenuItem, CheckMenuItem, PredefinedMenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_autostart::MacosLauncher;

use shortcuts::{load_saved_shortcuts, RegisteredShortcuts};

type PluginRegistry = Mutex<Vec<plugins::RegisteredPlugin>>;

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
    log::debug!("run_shell_command called with: {}", command);

    if !is_command_allowed(command) {
        log::warn!("Command not allowed: {}", command);
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
async fn discover_plugins(
    state: tauri::State<'_, PluginRegistry>,
) -> Result<Vec<plugins::RegisteredPlugin>, String> {
    let discovered = plugins::discover_plugins();
    *state.lock().map_err(|e| e.to_string())? = discovered.clone();
    Ok(discovered)
}

#[tauri::command]
async fn run_plugin_command(
    command_id: String,
    context: serde_json::Value,
    state: tauri::State<'_, PluginRegistry>,
) -> Result<serde_json::Value, String> {
    let (plugin, command) = {
        let registry = state.lock().map_err(|e| e.to_string())?;
        let (p, c) = plugins::find_command(&registry, &command_id).ok_or_else(|| {
            format!(
                "Plugin command '{}' not found — run discover_plugins first",
                command_id
            )
        })?;
        (p.clone(), c.clone())
    };
    plugins::run_plugin_command(&plugin, &command, context).await
}

#[tauri::command]
async fn prepare_plugin_install(git_url: String) -> Result<plugins::PluginPreviewInfo, String> {
    plugins::prepare_plugin_install(&git_url)
}

#[tauri::command]
async fn complete_plugin_install(
    temp_path: String,
    state: tauri::State<'_, PluginRegistry>,
) -> Result<Vec<plugins::RegisteredPlugin>, String> {
    plugins::complete_plugin_install(&temp_path)?;
    let discovered = plugins::discover_plugins();
    *state.lock().map_err(|e| e.to_string())? = discovered.clone();
    Ok(discovered)
}

#[tauri::command]
async fn cancel_plugin_install(temp_path: String) -> Result<(), String> {
    plugins::cancel_plugin_install(&temp_path)
}

#[tauri::command]
async fn check_plugin_updates(
    state: tauri::State<'_, PluginRegistry>,
) -> Result<Vec<plugins::UpdateResult>, String> {
    let plugins = state.lock().map_err(|e| e.to_string())?.clone();
    let results = plugins::check_plugin_updates(&plugins);
    Ok(results)
}

#[derive(serde::Serialize)]
struct NativePluginValidation {
    installed: bool,
    authenticated: bool,
    version: Option<String>,
    error: Option<String>,
}

#[tauri::command]
async fn validate_native_plugin(plugin_id: String) -> Result<NativePluginValidation, String> {
    if plugin_id != "github" {
        return Err(format!("Unknown native plugin: {}", plugin_id));
    }

    let version_output = tokio::process::Command::new("gh")
        .args(["--version"])
        .output()
        .await;

    let (installed, version) = match version_output {
        Ok(out) if out.status.success() => {
            let raw = String::from_utf8_lossy(&out.stdout).to_string();
            let ver = raw.lines().next().unwrap_or("").to_string();
            (true, Some(ver))
        }
        _ => (false, None),
    };

    if !installed {
        return Ok(NativePluginValidation {
            installed: false,
            authenticated: false,
            version: None,
            error: Some("gh CLI is not installed".to_string()),
        });
    }

    let auth_output = tokio::process::Command::new("gh")
        .args(["auth", "status"])
        .output()
        .await;

    let authenticated = match auth_output {
        Ok(out) => out.status.success(),
        Err(_) => false,
    };

    Ok(NativePluginValidation {
        installed: true,
        authenticated,
        version,
        error: if !authenticated {
            Some("Not authenticated. Run 'gh auth login'.".to_string())
        } else {
            None
        },
    })
}

#[tauri::command]
fn hide_main_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        shortcuts::unfocus_window(&window);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(RegisteredShortcuts {
            registered: vec![],
        }))
        .manage(Mutex::new(Vec::<plugins::RegisteredPlugin>::new()))
        .manage(tools::AiProcessState(Mutex::new(None)))
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: None,
                    }),
                ])
                .level(if cfg!(debug_assertions) {
                    log::LevelFilter::Debug
                } else {
                    log::LevelFilter::Info
                })
                .level_for("tao", log::LevelFilter::Error)
                .build(),
        )
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
            None,
        ))
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("main window not found");

            let _ = window.set_decorations(false);
            let _ = window.set_always_on_top(true);
            let _ = window.set_skip_taskbar(true);
            let _ = window.center();

            // Configurar system tray
            use tauri_plugin_autostart::ManagerExt;
            let autostart_enabled = app.autolaunch().is_enabled().unwrap_or(false);
            
            let show_i = MenuItem::with_id(app, "show", "Mostrar MRunner", true, None::<&str>)?;
            let settings_i = MenuItem::with_id(app, "settings", "Configurações", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let autostart_i = CheckMenuItem::with_id(app, "autostart", "Iniciar com o sistema", true, autostart_enabled, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
            
            let menu = Menu::with_items(app, &[&show_i, &settings_i, &separator, &autostart_i, &quit_i])?;

            let autostart_check = autostart_i.clone();
            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .icon(app.default_window_icon().unwrap().clone())
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            shortcuts::focus_window(&window);
                        }
                    }
                    "settings" => {
                        if let Some(window) = app.get_webview_window("main") {
                            shortcuts::focus_window(&window);
                            let _ = window.emit("open-settings", ());
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    "autostart" => {
                        use tauri_plugin_autostart::ManagerExt;
                        let autostart_manager = app.autolaunch();
                        let new_state = if autostart_manager.is_enabled().unwrap_or(false) {
                            let _ = autostart_manager.disable();
                            false
                        } else {
                            let _ = autostart_manager.enable();
                            true
                        };
                        let _ = autostart_check.set_checked(new_state);
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
                                    shortcuts::unfocus_window(&window);
                                } else {
                                    shortcuts::focus_window(&window);
                                }
                            }
                        }
                    }
                })
                .build(app)?;

            // Load saved shortcuts from preferences on startup
            if let Err(e) = load_saved_shortcuts(app.handle()) {
                log::warn!("Failed to load saved shortcuts: {}", e);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            run_shell_command,
            get_platform_info,
            get_user_directories,
            is_autostart_enabled,
            toggle_autostart,
            hide_main_window,
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
            discover_plugins,
            run_plugin_command,
            prepare_plugin_install,
            complete_plugin_install,
            cancel_plugin_install,
            check_plugin_updates,
            validate_native_plugin,
            tools::check_tool_installed,
            tools::list_ai_models,
            tools::send_ai_message,
            tools::cancel_ai_message,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
