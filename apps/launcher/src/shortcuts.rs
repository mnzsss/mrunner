use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

/// Activate a window on X11 by sending _NET_ACTIVE_WINDOW and XSetInputFocus.
/// This bypasses WM focus-stealing prevention, similar to how rofi/dmenu work.
#[cfg(target_os = "linux")]
fn x11_activate_window(xid: u64) {
    use std::ffi::CString;
    use std::mem;
    use x11_dl::xlib;

    unsafe {
        let xlib = match xlib::Xlib::open() {
            Ok(x) => x,
            Err(_) => return,
        };

        let display = (xlib.XOpenDisplay)(std::ptr::null());
        if display.is_null() {
            return;
        }

        let root = (xlib.XDefaultRootWindow)(display);
        let net_active = CString::new("_NET_ACTIVE_WINDOW").unwrap();
        let atom = (xlib.XInternAtom)(display, net_active.as_ptr(), 0);

        // Send _NET_ACTIVE_WINDOW with source=2 (pager) so KWin accepts it
        let mut event: xlib::XClientMessageEvent = mem::zeroed();
        event.type_ = xlib::ClientMessage;
        event.window = xid as xlib::Window;
        event.message_type = atom;
        event.format = 32;
        event.data.set_long(0, 2); // source indication: pager
        event.data.set_long(1, xlib::CurrentTime as i64);
        event.data.set_long(2, 0);

        (xlib.XSendEvent)(
            display,
            root,
            0,
            xlib::SubstructureRedirectMask | xlib::SubstructureNotifyMask,
            &mut event as *mut xlib::XClientMessageEvent as *mut xlib::XEvent,
        );

        (xlib.XSetInputFocus)(
            display,
            xid as xlib::Window,
            xlib::RevertToParent,
            xlib::CurrentTime,
        );

        (xlib.XFlush)(display);
        (xlib.XCloseDisplay)(display);
    }
}

/// Show window and force focus via X11.
#[cfg(target_os = "linux")]
pub fn focus_window(window: &tauri::WebviewWindow) {
    use gtk::prelude::{GtkWindowExt, WidgetExt};

    let _ = window.show();
    let _ = window.center();

    let handle = window.app_handle().clone();
    let handle2 = handle.clone();
    let _ = handle.run_on_main_thread(move || {
        if let Some(ww) = handle2.get_webview_window("main") {
            if let Ok(gtk_window) = ww.gtk_window() {
                gtk_window.present();

                if let Some(gdk_window) = gtk_window.window() {
                    use glib::object::Cast;
                    if let Ok(x11_window) = gdk_window.downcast::<gdkx11::X11Window>() {
                        x11_activate_window(x11_window.xid() as u64);
                    }
                }
            }
        }
    });
}

/// Hide window.
#[cfg(target_os = "linux")]
pub fn unfocus_window(window: &tauri::WebviewWindow) {
    let _ = window.hide();
}

#[cfg(not(target_os = "linux"))]
pub fn focus_window(window: &tauri::WebviewWindow) {
    let _ = window.show();
    let _ = window.center();
    let _ = window.set_focus();
}

#[cfg(not(target_os = "linux"))]
pub fn unfocus_window(window: &tauri::WebviewWindow) {
    let _ = window.hide();
}

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
                                        unfocus_window(&window);
                                    } else {
                                        focus_window(&window);
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
                                    unfocus_window(&window);
                                } else {
                                    focus_window(&window);
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
