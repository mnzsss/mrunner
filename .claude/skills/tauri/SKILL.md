---
name: tauri
description: Use when working with Tauri v2 backend/frontend integration, IPC, commands, events, plugins, permissions, capabilities, configuration, distribution, or any Rust-TypeScript bridge code. Triggers on: #[tauri::command], invoke(), @tauri-apps/api, tauri::Builder, tauri.conf.json, capabilities, permissions, State<>, AppHandle, Manager trait, system tray, window customization, tauri build, tauri dev, cargo tauri, tauri plugins, CSP, scopes, channels, events, emit, listen.
---

# Tauri v2 Reference

Quick-access reference for Tauri v2 development patterns. For topics not covered here, use the dynamic documentation lookup below.

## Dynamic Documentation Lookup

When the static references below don't cover your needs:

1. Resolve the library:
   - Call `mcp__context7__resolve-library-id` with `libraryName: "tauri"`
   - Expected result: `/websites/v2_tauri_app` (5952 snippets)

2. Query for your specific topic:
   - Call `mcp__context7__query-docs` with the resolved library ID and a descriptive topic
   - Good queries: "tauri command return result error", "plugin permissions", "window creation", "updater plugin", "deep linking", "stronghold", "notification plugin", "file dialog"
   - Be specific — "how to return errors from commands" beats "commands"

3. Apply patterns from docs directly. Do not guess Tauri v2 APIs.

## Quick Reference: Commands

### Define a command (Rust)

```rust
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}!")
}

// Register in builder
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![greet])
```

### Invoke from frontend (TypeScript)

```typescript
import { invoke } from '@tauri-apps/api/core';

const greeting = await invoke<string>('greet', { name: 'World' });
```

### Command with error handling

```rust
#[derive(Debug, thiserror::Error)]
enum MyError {
    #[error("not found: {0}")]
    NotFound(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

// Must implement Serialize for the error
impl serde::Serialize for MyError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(self.to_string().as_str())
    }
}

#[tauri::command]
fn read_file(path: String) -> Result<String, MyError> {
    std::fs::read_to_string(&path).map_err(Into::into)
}
```

### Async commands

```rust
#[tauri::command]
async fn fetch_data(url: String) -> Result<String, String> {
    // Async commands run on a separate thread — no blocking the main thread
    reqwest::get(&url).await
        .map_err(|e| e.to_string())?
        .text().await
        .map_err(|e| e.to_string())
}
```

### Accessing state and AppHandle

```rust
use tauri::State;

struct DbPool(Mutex<SqliteConnection>);

#[tauri::command]
fn get_count(pool: State<'_, DbPool>) -> i32 {
    let db = pool.0.lock().unwrap();
    db.count()
}

// With AppHandle
#[tauri::command]
fn with_app(app: tauri::AppHandle) -> Result<(), String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(())
}

// Register state in builder
tauri::Builder::default()
    .manage(DbPool(Mutex::new(conn)))
    .invoke_handler(tauri::generate_handler![get_count, with_app])
```

### Command argument rules

- Frontend sends **camelCase**, Rust receives **snake_case** (auto-converted)
- Arguments must implement `Deserialize`
- Return types must implement `Serialize`
- Use `Result<T, E>` where `E: Serialize` for fallible commands

## Quick Reference: Events

### Emit from Rust to frontend

```rust
use tauri::Emitter;

app.emit("event-name", payload)?;           // To all windows
app.emit_to("main", "event-name", payload)?; // To specific window
```

### Listen in frontend

```typescript
import { listen } from '@tauri-apps/api/event';

const unlisten = await listen<string>('event-name', (event) => {
    console.log(event.payload);
});

// Cleanup
unlisten();
```

### Listen in Rust

```rust
use tauri::Listener;

app.listen("event-name", |event| {
    println!("got event: {:?}", event.payload());
});
```

## Quick Reference: Channels

For streaming data from Rust to frontend (e.g., progress updates):

```rust
use tauri::ipc::Channel;

#[tauri::command]
fn download(url: String, on_progress: Channel<u64>) -> Result<(), String> {
    for i in 0..100 {
        on_progress.send(i).map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

```typescript
import { invoke, Channel } from '@tauri-apps/api/core';

const onProgress = new Channel<number>();
onProgress.onmessage = (progress) => {
    console.log(`Progress: ${progress}%`);
};

await invoke('download', { url: '...', onProgress });
```

## Quick Reference: Configuration

### Key files

| File | Purpose |
|------|---------|
| `tauri.conf.json` | Main Tauri config (app name, windows, bundle, security) |
| `Cargo.toml` | Rust dependencies and workspace config |
| `capabilities/*.json` | Permission grants per window |
| `src-tauri/src/lib.rs` | App builder setup |
| `src-tauri/src/main.rs` | Entry point (calls `lib::run()`) |

### Platform-specific overrides

In `tauri.conf.json`, use platform keys to override any config:

```jsonc
{
    "bundle": {
        "icon": ["icons/icon.png"],
        "linux": {
            "icon": ["icons/icon-linux.png"]  // Override for Linux only
        }
    }
}
```

Platform keys: `"linux"`, `"macOS"`, `"windows"`, `"iOS"`, `"android"`

### Environment variable overrides

- `TAURI_CONFIG` — JSON string merged into `tauri.conf.json`
- `TAURI_SIGNING_PRIVATE_KEY` — updater signing key
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — key password

## Quick Reference: State Management

```rust
use std::sync::Mutex;
use tauri::State;

// Define state wrapper
struct AppState {
    count: Mutex<i32>,
}

// Access in commands
#[tauri::command]
fn increment(state: State<'_, AppState>) -> i32 {
    let mut count = state.count.lock().unwrap();
    *count += 1;
    *count
}

// Register in builder
tauri::Builder::default()
    .manage(AppState { count: Mutex::new(0) })
    .invoke_handler(tauri::generate_handler![increment])
```

**Rules:**
- Inner data must be `Send + Sync + 'static`
- Use `Mutex<T>` or `RwLock<T>` for mutable state
- Access via `State<'_, YourType>` in commands
- Access via `app.state::<YourType>()` from `AppHandle`

## Quick Reference: Common Plugins

| Plugin | Crate | JS Package | Purpose |
|--------|-------|------------|---------|
| shell | `tauri-plugin-shell` | `@tauri-apps/plugin-shell` | Run external processes |
| fs | `tauri-plugin-fs` | `@tauri-apps/plugin-fs` | File system access |
| dialog | `tauri-plugin-dialog` | `@tauri-apps/plugin-dialog` | Native file/message dialogs |
| store | `tauri-plugin-store` | `@tauri-apps/plugin-store` | Persistent key-value storage |
| updater | `tauri-plugin-updater` | `@tauri-apps/plugin-updater` | Auto-updates |
| notification | `tauri-plugin-notification` | `@tauri-apps/plugin-notification` | System notifications |
| clipboard | `tauri-plugin-clipboard-manager` | `@tauri-apps/plugin-clipboard-manager` | Clipboard access |
| http | `tauri-plugin-http` | `@tauri-apps/plugin-http` | HTTP client |
| os | `tauri-plugin-os` | `@tauri-apps/plugin-os` | OS information |
| process | `tauri-plugin-process` | `@tauri-apps/plugin-process` | Process management (exit, restart) |
| log | `tauri-plugin-log` | `@tauri-apps/plugin-log` | Logging with file/console targets |
| stronghold | `tauri-plugin-stronghold` | `@tauri-apps/plugin-stronghold` | Encrypted storage |
| deep-link | `tauri-plugin-deep-link` | `@tauri-apps/plugin-deep-link` | Custom URL scheme handling |
| autostart | `tauri-plugin-autostart` | `@tauri-apps/plugin-autostart` | Launch at system startup |
| window-state | `tauri-plugin-window-state` | `@tauri-apps/plugin-window-state` | Remember window size/position |
| global-shortcut | `tauri-plugin-global-shortcut` | `@tauri-apps/plugin-global-shortcut` | System-wide keyboard shortcuts |
| single-instance | `tauri-plugin-single-instance` | N/A | Prevent multiple instances |

### Adding a plugin

```bash
# Add to Rust project
cargo add tauri-plugin-<name>

# Add JS bindings
pnpm add @tauri-apps/plugin-<name>
```

```rust
// Register in builder
tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_store::Builder::new().build())
```

```jsonc
// Grant permissions in capabilities/*.json
{
    "permissions": [
        "shell:allow-open",
        "fs:allow-read",
        "store:default"
    ]
}
```

## Quick Reference: CLI Commands

| Command | Purpose |
|---------|---------|
| `cargo tauri dev` | Run app in dev mode with hot-reload |
| `cargo tauri build` | Build production binary |
| `cargo tauri icon <path>` | Generate app icons from source image |
| `cargo tauri info` | Show environment info for debugging |
| `cargo tauri add <plugin>` | Add a Tauri plugin to the project |
| `cargo tauri completions` | Generate shell completions |

Build flags: `--debug` (debug build), `--target <triple>` (cross-compile), `--bundles <format>` (deb/rpm/appimage/nsis/msi/dmg)

## Common Patterns & Gotchas

### v2 vs v1 breaking changes
- `tauri::command` attribute unchanged, but error handling now requires `Serialize` on error types
- Events API: use `Emitter`/`Listener` traits instead of direct methods
- Plugins moved from `tauri::plugin` to standalone crates (`tauri-plugin-*`)
- Permissions system is new — every plugin action needs explicit capability grants
- JS imports changed: `@tauri-apps/api/core` (was `@tauri-apps/api/tauri`)

### Argument naming
Frontend `invoke('cmd', { myArg: 1 })` → Rust receives `my_arg: i32`. The camelCase-to-snake_case conversion is automatic.

### Commands must be registered
Every `#[tauri::command]` function must be listed in `generate_handler![]`. Forgetting this causes "command not found" errors at runtime.

### State must be registered before access
Call `.manage(YourState { ... })` before `.build()`. Accessing unregistered state panics.

### Permissions are mandatory in v2
Unlike v1, calling any plugin API without the right permission in a capability file silently fails or returns an error. Always check `src-tauri/capabilities/` when adding plugin features.

### Async command thread behavior
Async commands run on the async runtime. Non-async commands run on a **blocking thread pool** — they won't block the main thread but each invocation takes a thread.

### Window labels are identifiers
Window labels (e.g., `"main"`) are used for targeted events and permission scoping. Keep them consistent.

## Detailed References

Consult these for in-depth information:

| Reference | When to read |
|-----------|-------------|
| `references/commands_and_ipc.md` | IPC patterns, channels, isolation, brownfield integration |
| `references/security_and_permissions.md` | Capabilities, permissions, scopes, CSP, runtime authority |
| `references/state_and_plugins.md` | State management patterns, plugin development, mobile plugins |
| `references/configuration.md` | Project structure, tauri.conf.json schema, platform overrides |
| `references/distribution.md` | Building, signing, installers, CI/CD pipelines |
| `references/ui_patterns.md` | System tray, window customization, menus, splashscreen |
