# Tauri v2 UI Patterns Reference

## Table of Contents

- [System Tray](#system-tray)
- [Window Customization](#window-customization)
- [Window Menus](#window-menus)
- [Splashscreen](#splashscreen)

---

## System Tray

Enable in `Cargo.toml`: `tauri = { version = "2", features = ["tray-icon"] }`

### Creating a Tray Icon

```rust
use tauri::tray::TrayIconBuilder;

tauri::Builder::default()
  .setup(|app| {
    let tray = TrayIconBuilder::new()
      .icon(app.default_window_icon().unwrap().clone())
      .build(app)?;
    Ok(())
  })
```

```javascript
import { TrayIcon } from '@tauri-apps/api/tray';
import { defaultWindowIcon } from '@tauri-apps/api/app';

const tray = await TrayIcon.new({ icon: await defaultWindowIcon() });
```

### Tray with Menu

```rust
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;

let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
let menu = Menu::with_items(app, &[&quit_i])?;

let tray = TrayIconBuilder::new()
  .icon(app.default_window_icon().unwrap().clone())
  .menu(&menu)
  .menu_on_left_click(true)
  .on_menu_event(|app, event| match event.id.as_ref() {
    "quit" => app.exit(0),
    _ => {}
  })
  .build(app)?;
```

```javascript
import { TrayIcon } from '@tauri-apps/api/tray';
import { Menu } from '@tauri-apps/api/menu';

const menu = await Menu.new({
  items: [{ id: 'quit', text: 'Quit', action: () => console.log('quit') }],
});
const tray = await TrayIcon.new({ menu, menuOnLeftClick: true });
```

### Tray Icon Events

Events: `Click`, `DoubleClick`, `Enter`, `Move`, `Leave`. **Linux: events are unsupported.**

```rust
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

TrayIconBuilder::new()
  .on_tray_icon_event(|tray, event| match event {
    TrayIconEvent::Click {
      button: MouseButton::Left, button_state: MouseButtonState::Up, ..
    } => {
      let app = tray.app_handle();
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
      }
    }
    _ => {}
  })
```

```javascript
const tray = await TrayIcon.new({
  action: (event) => {
    if (event.type === 'Click') {
      console.log(`${event.button} button, state: ${event.buttonState}`);
    }
  },
});
```

> Source: <https://v2.tauri.app/learn/system-tray/>

---

## Window Customization

### Disabling Native Decorations

In `tauri.conf.json`:

```json
{ "windows": [{ "decorations": false }] }
```

Required capability in `src-tauri/capabilities/default.json`:

```json
{
  "identifier": "main-capability",
  "windows": ["main"],
  "permissions": ["core:window:default", "core:window:allow-start-dragging"]
}
```

### Custom Titlebar (HTML + CSS)

```html
<div class="titlebar">
  <div data-tauri-drag-region></div>
  <div class="controls">
    <button id="titlebar-minimize">&#x2013;</button>
    <button id="titlebar-maximize">&#x25A1;</button>
    <button id="titlebar-close">&#x2715;</button>
  </div>
</div>
```

```css
.titlebar {
  height: 30px;
  user-select: none;
  display: grid;
  grid-template-columns: auto max-content;
  position: fixed;
  top: 0; left: 0; right: 0;
}
.titlebar button { width: 30px; border: none; background: transparent; }
```

```javascript
import { getCurrentWindow } from '@tauri-apps/api/window';
const appWindow = getCurrentWindow();

document.getElementById('titlebar-minimize')?.addEventListener('click', () => appWindow.minimize());
document.getElementById('titlebar-maximize')?.addEventListener('click', () => appWindow.toggleMaximize());
document.getElementById('titlebar-close')?.addEventListener('click', () => appWindow.close());
```

Note: `data-tauri-drag-region` only works on the element it is directly applied to.

### Manual Drag with Double-Click Maximize

```javascript
document.getElementById('titlebar')?.addEventListener('mousedown', (e) => {
  if (e.buttons === 1) {
    e.detail === 2 ? appWindow.toggleMaximize() : appWindow.startDragging();
  }
});
```

### macOS Transparent Titlebar

```rust
use tauri::{TitleBarStyle, WebviewUrl, WebviewWindowBuilder};

let win_builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
  .title("My App")
  .inner_size(800.0, 600.0);

#[cfg(target_os = "macos")]
let win_builder = win_builder.title_bar_style(TitleBarStyle::Transparent);

let window = win_builder.build().unwrap();
```

Requires `cocoa = "0.26"` under `[target."cfg(target_os = \"macos\")".dependencies]` for custom background colors.

> Source: <https://v2.tauri.app/learn/window-customization/>

---

## Window Menus

### Basic Menu

```rust
use tauri::menu::MenuBuilder;

let menu = MenuBuilder::new(app)
  .text("open", "Open")
  .text("close", "Close")
  .check("check_item", "Check Item")
  .separator()
  .build()?;

app.set_menu(menu)?;

app.on_menu_event(move |_app, event| {
  match event.id().0.as_str() {
    "open" => { /* handle */ }
    "close" => { /* handle */ }
    _ => {}
  }
});
```

```javascript
import { Menu } from '@tauri-apps/api/menu';

const menu = await Menu.new({
  items: [
    { id: 'open', text: 'Open', action: () => console.log('open') },
    { id: 'close', text: 'Close', action: () => console.log('close') },
    { item: 'Separator' },
    { id: 'disabled', text: 'Disabled', enabled: false },
  ],
});
await menu.setAsAppMenu();
```

### Submenus

```rust
use tauri::menu::{MenuBuilder, SubmenuBuilder};

let file_menu = SubmenuBuilder::new(app, "File")
  .text("new", "New")
  .text("open", "Open")
  .build()?;

let menu = MenuBuilder::new(app).items(&[&file_menu]).build()?;
app.set_menu(menu)?;
```

```javascript
import { Menu, MenuItem, Submenu } from '@tauri-apps/api/menu';

const fileSubmenu = await Submenu.new({
  text: 'File',
  items: [
    await MenuItem.new({ id: 'new', text: 'New', action: () => {} }),
    await MenuItem.new({ id: 'open', text: 'Open', action: () => {} }),
  ],
});
const menu = await Menu.new({ items: [fileSubmenu] });
await menu.setAsAppMenu();
```

**macOS note:** All items must be grouped under submenus; top-level items are ignored. The first submenu appears under the app's About menu.

### Predefined Menu Items

```rust
use tauri::menu::MenuBuilder;

let menu = MenuBuilder::new(app)
  .copy().cut().paste().select_all().undo().redo().separator()
  .build()?;
app.set_menu(menu)?;
```

```javascript
import { Menu, PredefinedMenuItem } from '@tauri-apps/api/menu';

const menu = await Menu.new({
  items: [
    await PredefinedMenuItem.new({ item: 'Copy' }),
    await PredefinedMenuItem.new({ item: 'Separator' }),
    await PredefinedMenuItem.new({ item: 'Undo' }),
    await PredefinedMenuItem.new({ item: 'Redo' }),
  ],
});
await menu.setAsAppMenu();
```

### Dynamic Menu Updates

Available operations: `setText()` / `set_text()`, `setChecked()` / `set_checked()`, `setIcon()` / `set_icon()`, `setAccelerator()` / `set_accelerator()`.

Submenu icons require Tauri >= 2.8.0 and the `image-png` feature flag.

> Source: <https://v2.tauri.app/learn/window-menu/>

---

## Splashscreen

### Configuration

In `tauri.conf.json`, define two windows:

```json
{
  "windows": [
    { "label": "main", "visible": false },
    { "label": "splashscreen", "url": "/splashscreen" }
  ]
}
```

### Backend Setup (Rust)

```rust
use std::sync::Mutex;
use tauri::{async_runtime::spawn, AppHandle, Manager, State};
use tokio::time::{sleep, Duration};

struct SetupState { frontend_task: bool, backend_task: bool }

pub fn run() {
  tauri::Builder::default()
    .manage(Mutex::new(SetupState { frontend_task: false, backend_task: false }))
    .invoke_handler(tauri::generate_handler![set_complete])
    .setup(|app| {
      spawn(setup(app.handle().clone()));
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[tauri::command]
async fn set_complete(
  app: AppHandle,
  state: State<'_, Mutex<SetupState>>,
  task: String,
) -> Result<(), ()> {
  let mut s = state.lock().unwrap();
  match task.as_str() {
    "frontend" => s.frontend_task = true,
    "backend" => s.backend_task = true,
    _ => panic!("invalid task"),
  }
  if s.backend_task && s.frontend_task {
    app.get_webview_window("splashscreen").unwrap().close().unwrap();
    app.get_webview_window("main").unwrap().show().unwrap();
  }
  Ok(())
}

async fn setup(app: AppHandle) -> Result<(), ()> {
  sleep(Duration::from_secs(3)).await; // simulate heavy work
  set_complete(app.clone(), app.state::<Mutex<SetupState>>(), "backend".into()).await
}
```

Requires: `cargo add tokio -F time`

### Frontend Setup (TypeScript)

```typescript
import { invoke } from '@tauri-apps/api/core';

async function setup() {
  // perform heavy frontend initialization
  await new Promise(resolve => setTimeout(resolve, 3000));
  invoke('set_complete', { task: 'frontend' });
}

window.addEventListener('DOMContentLoaded', () => setup());
```

### Important Notes

- Never use `std::thread::sleep` in async functions -- use `tokio::time::sleep` instead. Blocking the thread freezes all tasks on that thread.
- Pattern: hidden main window + visible splashscreen; close splash and show main once both frontend and backend tasks complete.
- Consider using an in-window spinner instead of a splashscreen when possible.

> Source: <https://v2.tauri.app/learn/splashscreen/>
