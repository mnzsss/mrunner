# Tauri v2 Commands & IPC Reference

## Table of Contents

- [Defining Commands](#defining-commands)
- [Invoking from Frontend](#invoking-from-frontend)
- [Command Arguments](#command-arguments)
- [Return Values & Errors](#return-values--errors)
- [Async Commands](#async-commands)
- [Accessing State in Commands](#accessing-state-in-commands)
- [Events (emit/listen)](#events-emitlisten)
- [Channels](#channels)
- [IPC Concepts](#ipc-concepts)
- [Brownfield IPC](#brownfield-ipc)
- [Isolation Pattern](#isolation-pattern)

---

## Defining Commands

Use `#[tauri::command]` and register with `generate_handler!`. Commands in `lib.rs` must NOT be `pub`; commands in submodules must be `pub`. Names must be unique. You cannot call `invoke_handler` multiple times.

```rust
// src-tauri/src/commands.rs
#[tauri::command]
pub fn greet(name: String) -> String {
    format!("Hello, {name}!")
}
```

```rust
// src-tauri/src/lib.rs
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::greet,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

> Source: <https://v2.tauri.app/develop/calling-rust/>

---

## Invoking from Frontend

```typescript
import { invoke } from '@tauri-apps/api/core';

const message = await invoke<string>('greet', { name: 'World' });
```

Arguments are passed as an object. Keys are **camelCase** by default (Rust snake_case params are auto-converted).

> Source: <https://v2.tauri.app/develop/calling-rust/>

---

## Command Arguments

Parameters must implement `serde::Deserialize`. JS keys use camelCase unless overridden:

```rust
#[tauri::command]
fn save_file(file_path: String, contents: String) { /* ... */ }
```

```javascript
invoke('save_file', { filePath: '/tmp/a.txt', contents: 'data' });
```

Override with `rename_all` to accept snake_case from JS:

```rust
#[tauri::command(rename_all = "snake_case")]
fn save_file(file_path: String, contents: String) { /* ... */ }
```

### Raw Request Access

Access the full IPC request (body bytes, headers):

```rust
#[tauri::command]
fn upload(request: tauri::ipc::Request) -> Result<(), String> {
    let tauri::ipc::InvokeBody::Raw(data) = request.body() else {
        return Err("expected raw body".into());
    };
    let auth = request.headers().get("Authorization");
    Ok(())
}
```

```javascript
await __TAURI__.core.invoke('upload', new Uint8Array([1, 2, 3]), {
    headers: { Authorization: 'Bearer token' },
});
```

> Source: <https://v2.tauri.app/develop/calling-rust/>

---

## Return Values & Errors

Return types must implement `serde::Serialize`. Returning `Result<T, E>` maps `Ok` to promise resolution and `Err` to rejection.

```rust
#[derive(Debug, thiserror::Error)]
enum Error {
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

// Must manually implement Serialize for error types
impl serde::Serialize for Error {
    fn serialize<S: serde::ser::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(self.to_string().as_ref())
    }
}

#[tauri::command]
fn read_file(path: String) -> Result<Vec<u8>, Error> {
    Ok(std::fs::read(path)?)
}
```

```javascript
invoke('read_file', { path: '/tmp/a.txt' })
    .then((bytes) => console.log(bytes))
    .catch((err) => console.error(err)); // receives serialized error string
```

### Structured Errors

```rust
#[derive(serde::Serialize)]
#[serde(tag = "kind", content = "message")]
enum ErrorKind { Io(String), NotFound(String) }
```

### Returning Raw Bytes

Avoid JSON overhead for large data with `tauri::ipc::Response`:

```rust
use tauri::ipc::Response;

#[tauri::command]
fn read_image() -> Response {
    Response::new(std::fs::read("/path/to/image.png").unwrap())
}
```

> Source: <https://v2.tauri.app/develop/calling-rust/>

---

## Async Commands

Async commands run on `async_runtime::spawn`, preventing UI freezes.

```rust
#[tauri::command]
async fn fetch_data(url: String) -> Result<String, String> {
    // borrowed types like &str are NOT allowed in async command signatures
    reqwest::get(&url).await.map_err(|e| e.to_string())?
        .text().await.map_err(|e| e.to_string())
}
```

**Limitation**: Borrowed types (`&str`, `State<'_, T>`) cannot appear in async signatures directly. Workarounds:
1. Use owned types (`String` instead of `&str`).
2. Wrap the return in `Result<T, E>` which allows `&str` in some cases.

> Source: <https://v2.tauri.app/develop/calling-rust/>

---

## Accessing State in Commands

### Managed State

```rust
struct Db(std::sync::Mutex<Vec<String>>);

#[tauri::command]
fn add_item(item: String, db: tauri::State<Db>) {
    db.0.lock().unwrap().push(item);
}

pub fn run() {
    tauri::Builder::default()
        .manage(Db(Default::default()))
        .invoke_handler(tauri::generate_handler![add_item])
        .run(tauri::generate_context!())
        .expect("error");
}
```

### AppHandle & WebviewWindow

These are injected automatically (not passed from JS):

```rust
#[tauri::command]
async fn window_label(window: tauri::WebviewWindow, app: tauri::AppHandle) {
    println!("called from window: {}", window.label());
    let _ = app.path().app_data_dir();
}
```

> Source: <https://v2.tauri.app/develop/calling-rust/>

---

## Events (emit/listen)

Events are fire-and-forget, always async, cannot return values, and only carry JSON payloads. They do not participate in the capability/permission system.

### Emit from Rust

```rust
use tauri::{AppHandle, Emitter};

#[tauri::command]
fn notify(app: AppHandle) {
    // Global (all listeners)
    app.emit("status-changed", "ready").unwrap();

    // To a specific webview
    app.emit_to("settings", "config-updated", true).unwrap();
}
```

Filter targets with `emit_filter`:

```rust
use tauri::EventTarget;

app.emit_filter("open-file", &path, |target| match target {
    EventTarget::WebviewWindow { label } => label == "main",
    _ => false,
}).unwrap();
```

### Listen in Rust

```rust
use tauri::Listener;

app.listen("download-started", |event| {
    println!("payload: {}", event.payload());
});

// Listen once
app.once("ready", |_event| { /* ... */ });

// Unlisten
let id = app.listen("evt", |_| {});
app.unlisten(id);
```

### Emit from Frontend

```javascript
import { emit, emitTo } from '@tauri-apps/api/event';

emit('file-selected', '/path/to/file');
emitTo('settings', 'update-config', { key: 'theme', value: 'dark' });
```

### Listen in Frontend

```typescript
import { listen, once } from '@tauri-apps/api/event';

const unlisten = await listen<{ url: string }>('download-started', (event) => {
    console.log(event.payload.url);
});
unlisten(); // stop listening

await once('ready', () => {});
```

**Note**: Webview-specific events are NOT delivered to global listeners. Use `{ target: { kind: 'Any' } }` as third arg to `listen` to catch all.

> Sources: <https://v2.tauri.app/develop/calling-rust/> , <https://v2.tauri.app/develop/calling-frontend/>

---

## Channels

Channels provide **ordered, high-throughput** streaming from Rust to the frontend. Preferred over events for large or frequent data.

### Rust Side

```rust
use tauri::ipc::Channel;
use serde::Serialize;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
enum DownloadEvent<'a> {
    #[serde(rename_all = "camelCase")]
    Started { url: &'a str, content_length: usize },
    #[serde(rename_all = "camelCase")]
    Progress { chunk_length: usize },
    Finished,
}

#[tauri::command]
fn download(url: String, on_event: Channel<DownloadEvent>) {
    on_event.send(DownloadEvent::Started { url: &url, content_length: 1000 }).unwrap();
    on_event.send(DownloadEvent::Progress { chunk_length: 500 }).unwrap();
    on_event.send(DownloadEvent::Finished).unwrap();
}
```

### Frontend Side

```typescript
import { invoke, Channel } from '@tauri-apps/api/core';

type DownloadEvent =
    | { event: 'started'; data: { url: string; contentLength: number } }
    | { event: 'progress'; data: { chunkLength: number } }
    | { event: 'finished' };

const onEvent = new Channel<DownloadEvent>();
onEvent.onmessage = (msg) => console.log(msg.event, msg.data);

await invoke('download', { url: 'https://example.com/file', onEvent });
```

> Source: <https://v2.tauri.app/develop/calling-frontend/>

---

## IPC Concepts

Tauri uses **asynchronous message passing** between isolated processes. All data is serialized (JSON-RPC under the hood). The Tauri Core can reject/discard any request, avoiding shared-memory vulnerabilities.

| Primitive | Direction | Returns? | Type-safe? | Capabilities? |
|-----------|-----------|----------|------------|---------------|
| Commands  | FE -> Rust | Yes (Result) | Yes (serde) | Yes |
| Events    | Both       | No          | No (JSON)   | No  |
| Channels  | Rust -> FE | No          | Yes (serde) | Yes |

> Source: <https://v2.tauri.app/concept/inter-process-communication/>

---

## Brownfield IPC

The **default** IPC pattern. No special configuration needed. Designed for maximum compatibility with standard web frontends.

```json
{
  "app": {
    "security": {
      "pattern": { "use": "brownfield" }
    }
  }
}
```

No additional options exist. Use this when your frontend dependencies are trusted and you want the simplest setup.

> Source: <https://v2.tauri.app/concept/inter-process-communication/brownfield/>

---

## Isolation Pattern

A security layer that intercepts IPC messages via a sandboxed `<iframe>`, encrypting them with AES-GCM before they reach Tauri Core. Recommended when the app has many/untrusted frontend dependencies.

### Configuration

```json
{
  "app": {
    "security": {
      "pattern": {
        "use": "isolation",
        "options": { "dir": "../dist-isolation" }
      }
    }
  }
}
```

### Isolation Script (`../dist-isolation/index.html`)

```html
<!doctype html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Isolation</title></head>
<body><script src="index.js"></script></body>
</html>
```

```javascript
// ../dist-isolation/index.js
window.__TAURI_ISOLATION_HOOK__ = (payload) => {
    // validate/modify IPC payload before it reaches Rust
    return payload;
};
```

### Key Notes

- Runtime-generated AES-GCM keys (new per app launch).
- ES Modules do NOT work inside the isolation iframe (Windows sandbox limitation).
- Keep the isolation script minimal to reduce supply-chain risk.
- Small performance overhead from encryption; negligible for most apps.

> Source: <https://v2.tauri.app/concept/inter-process-communication/isolation/>
