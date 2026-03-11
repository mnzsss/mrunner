# Tauri v2 -- State Management & Plugin Development

## Table of Contents

1. [State Management](#state-management)
2. [Plugin Development](#plugin-development)
3. [Plugin JavaScript API](#plugin-javascript-api)
4. [Mobile Plugin Development](#mobile-plugin-development)

---

## State Management

### Managing State

Register state via `Manager::manage` and retrieve it with `Manager::state`:

```rust
use tauri::{Builder, Manager};

struct AppData {
    welcome_message: &'static str,
}

fn main() {
    Builder::default()
        .setup(|app| {
            app.manage(AppData { welcome_message: "Hello!" });
            Ok(())
        })
        .run(tauri::generate_context!())
        .unwrap()
}
```

### Mutex Pattern for Mutable State

Shared state requires interior mutability. Use `std::sync::Mutex` (preferred over `tokio::sync::Mutex` unless holding the guard across `.await` points). `Arc` is not needed -- `State` wraps values automatically.

```rust
use std::sync::Mutex;
use tauri::{Builder, Manager};

#[derive(Default)]
struct AppStateInner {
    counter: u32,
}
type AppState = Mutex<AppStateInner>;

fn main() {
    Builder::default()
        .setup(|app| {
            app.manage(AppState::default());
            Ok(())
        })
        .run(tauri::generate_context!())
        .unwrap()
}
```

> **Tip:** Use a type alias (`type AppState = Mutex<AppStateInner>`) to avoid mismatched types, which cause runtime panics rather than compile errors.

### Accessing State in Commands

```rust
use tauri::State;

#[tauri::command]
fn increase_counter(state: State<'_, AppState>) -> u32 {
    let mut s = state.lock().unwrap();
    s.counter += 1;
    s.counter
}

// Async variant -- return type must be Result
#[tauri::command]
async fn increase_counter_async(state: State<'_, AppState>) -> Result<u32, ()> {
    let mut s = state.lock().unwrap();
    s.counter += 1;
    Ok(s.counter)
}
```

### Accessing State Outside Commands

Any type implementing `Manager` (`AppHandle`, `Window`, etc.) exposes `.state()`:

```rust
fn on_window_event(window: &tauri::Window, _event: &tauri::WindowEvent) {
    let state = window.app_handle().state::<AppState>();
    state.lock().unwrap().counter += 1;
}
```

> Source: <https://v2.tauri.app/develop/state-management/>

---

## Plugin Development

### Scaffold a Plugin

```bash
npx @tauri-apps/cli plugin new <name>  # --android / --ios / --no-api
```

Generated layout:

```
tauri-plugin-<name>/
  src/          commands.rs, desktop.rs, mobile.rs, lib.rs, error.rs, models.rs
  permissions/  TOML/JSON permission files
  guest-js/     TypeScript source
  build.rs      Auto-generates permission definitions
```

### Plugin Entry Point (`lib.rs`)

```rust
use tauri::plugin::{Builder, Runtime, TauriPlugin};
use serde::Deserialize;

#[derive(Deserialize)]
struct Config {
    timeout: usize,
}

pub fn init<R: Runtime>() -> TauriPlugin<R, Config> {
    Builder::<R, Config>::new("<plugin-name>")
        .setup(|app, api| {
            let _timeout = api.config().timeout;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![commands::upload])
        .build()
}
```

### Lifecycle Hooks

| Hook               | Signature / Purpose                                       |
| ------------------- | --------------------------------------------------------- |
| `setup`             | `\|app, api\| { ... }` -- register state, spawn tasks    |
| `on_navigation`     | `\|window, url\| -> bool` -- return `false` to block nav |
| `on_webview_ready`  | `\|window\| { ... }` -- per-window init                  |
| `on_event`          | `\|app, event\| { ... }` -- handle `RunEvent` variants   |
| `on_drop`           | `\|app\| { ... }` -- cleanup on plugin destruction       |

### Plugin Commands

```rust
// src/commands.rs
use tauri::{command, ipc::Channel, AppHandle, Runtime};

#[command]
async fn upload<R: Runtime>(app: AppHandle<R>, on_progress: Channel, url: String) {
    on_progress.send(100).unwrap();
}
```

### Permissions

Auto-generate allow/deny per command in `build.rs`:

```rust
const COMMANDS: &[&str] = &["upload"];
fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
```

Manual permission files (`permissions/default.toml`):

```toml
[default]
description = "Default permissions"
permissions = ["allow-upload"]

[[permission]]
identifier = "allow-upload"
description = "Allows the upload command"
commands.allow = ["upload"]
```

Permission sets group multiple permissions:

```toml
[[set]]
identifier = "allow-websocket"
description = "Allows connecting and sending messages"
permissions = ["allow-connect", "allow-send"]
```

### Scopes

Define a scope schema with `schemars`, then access it in commands:

```rust
use tauri::ipc::{CommandScope, GlobalScope};

#[derive(Debug, schemars::JsonSchema)]
pub struct Entry { pub binary: String }

#[tauri::command]
async fn spawn<R: tauri::Runtime>(
    command_scope: CommandScope<'_, Entry>,
    global_scope: GlobalScope<'_, Entry>,
) -> Result<(), ()> {
    let _allowed = command_scope.allows();
    let _denied  = global_scope.denies();
    Ok(())
}
```

> Source: <https://v2.tauri.app/develop/plugins/>

---

## Plugin JavaScript API

### Invoking Plugin Commands

```typescript
import { invoke, Channel } from '@tauri-apps/api/core';

export async function upload(
  url: string,
  onProgress: (progress: number) => void,
): Promise<void> {
  const ch = new Channel<number>();
  ch.onmessage = onProgress;
  await invoke('plugin:<plugin-name>|upload', { url, onProgress: ch });
}
```

### Permission Handling

```typescript
import { invoke, PermissionState } from '@tauri-apps/api/core';

interface Permissions { postNotification: PermissionState }

const perms = await invoke<Permissions>('plugin:<plugin-name>|checkPermissions');
if (perms.postNotification.startsWith('prompt')) {
  await invoke<Permissions>('plugin:<plugin-name>|requestPermissions', {
    permissions: ['postNotification'],
  });
}
```

### Listening to Plugin Events

```typescript
import { addPluginListener, PluginListener } from '@tauri-apps/api/core';

export async function onRequest(handler: (url: string) => void): Promise<PluginListener> {
  return addPluginListener('<plugin-name>', 'event-name', handler);
}
```

> Source: <https://v2.tauri.app/develop/plugins/>

---

## Mobile Plugin Development

### Android (Kotlin)

```kotlin
import app.tauri.annotation.TauriPlugin
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.plugin.Plugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject

@InvokeArg
internal class OpenArgs {
    lateinit var requiredArg: String   // required
    var allowEdit: Boolean = false     // default value
    var quality: Int? = null           // optional
}

@TauriPlugin
class ExamplePlugin(private val activity: android.app.Activity) : Plugin(activity) {
    @Command
    fun openCamera(invoke: Invoke) {
        val args = invoke.parseArgs(OpenArgs::class.java)
        val ret = JSObject()
        ret.put("path", "/path/to/photo.jpg")
        invoke.resolve(ret)
    }
}
```

Configuration via `load`:

```kotlin
@InvokeArg
class Config { var timeout: Int? = 3000 }

override fun load(webView: android.webkit.WebView) {
    getConfig(Config::class.java).let { this.timeout = it.timeout }
}
```

Android permissions:

```kotlin
@TauriPlugin(permissions = [
    Permission(strings = [android.Manifest.permission.POST_NOTIFICATIONS], alias = "postNotification")
])
class ExamplePlugin(private val activity: android.app.Activity) : Plugin(activity)
```

> On Android, commands run on the main thread by default. Use coroutines for long-running operations.

### iOS (Swift)

```swift
import Tauri

class OpenArgs: Decodable {
    let requiredArg: String   // required
    var allowEdit: Bool?      // optional (no default values -- use optionals)
}

class ExamplePlugin: Plugin {
    @objc public func openCamera(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(OpenArgs.self)
        invoke.resolve(["path": "/path/to/photo.jpg"])
    }
}
```

Configuration via `load`:

```swift
struct Config: Decodable { let timeout: Int? }

@objc public override func load(webview: WKWebView) {
    if let config = try? parseConfig(Config.self) { self.timeout = config.timeout }
}
```

### Calling Mobile Commands from Rust

```rust
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CameraRequest { quality: usize, allow_edit: bool }

#[derive(Deserialize)]
pub struct Photo { path: std::path::PathBuf }

impl<R: tauri::Runtime> ExamplePlugin<R> {
    pub fn open_camera(&self, payload: CameraRequest) -> crate::Result<Photo> {
        self.0.run_mobile_plugin("openCamera", payload).map_err(Into::into)
    }
}
```

### Emitting Events from Mobile

```kotlin
// Android
trigger("camera", JSObject().apply { put("open", true) })
```

```swift
// iOS
trigger("camera", data: ["open": true])
```

> Source: <https://v2.tauri.app/develop/plugins/develop-mobile/>
