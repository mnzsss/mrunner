# Tauri v2 Configuration Reference

## Table of Contents

- [Project Structure](#project-structure)
- [tauri.conf.json](#tauriconfjson)
- [Cargo.toml Configuration](#cargotoml-configuration)
- [Platform-Specific Overrides](#platform-specific-overrides)
- [Environment Variables and CLI Extensions](#environment-variables-and-cli-extensions)
- [Build Configuration](#build-configuration)

---

## Project Structure

A Tauri v2 project combines a web frontend with a Rust backend:

```
.
├── package.json
├── index.html
├── src/                      # Frontend source
│   └── main.js
├── src-tauri/                # Rust backend
│   ├── Cargo.toml            # Rust dependencies and metadata
│   ├── Cargo.lock            # Pinned dependency versions (commit this)
│   ├── build.rs              # Runs tauri_build::build()
│   ├── tauri.conf.json       # Primary Tauri configuration
│   ├── src/
│   │   ├── main.rs           # Desktop entry point — calls app_lib::run()
│   │   └── lib.rs            # Core app logic + mobile entry point
│   ├── icons/                # Output of `tauri icon` command
│   │   ├── icon.png
│   │   ├── icon.icns
│   │   └── icon.ico
│   └── capabilities/         # Security: allowed commands from JS
│       └── default.json
```

**Key files:**

- **`lib.rs`** — Houses Rust application code. Annotated with `#[cfg_attr(mobile, tauri::mobile_entry_point)]` for unified desktop/mobile entry.
- **`main.rs`** — Desktop-only entry point. Calls `app_lib::run()` (where `app_lib` matches `[lib.name]` in Cargo.toml). Keep minimal; put logic in `lib.rs`.
- **`build.rs`** — Must contain `tauri_build::build()` to power the Tauri build system.
- **`capabilities/`** — Defines which Tauri commands are accessible from the frontend (security model).

> Source: https://v2.tauri.app/start/project-structure/

---

## tauri.conf.json

The primary configuration file. Also acts as a marker for the Tauri CLI to locate the Rust project. Supported formats: JSON (default), JSON5, TOML (via feature flags).

### Full Example (JSON)

```json
{
  "productName": "MyApp",
  "version": "0.1.0",
  "identifier": "com.myorg.myapp",
  "build": {
    "devUrl": "http://localhost:3000",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "bundle": {
    "active": true,
    "icon": ["icons/app.png"]
  },
  "app": {
    "windows": [
      {
        "title": "MyApp"
      }
    ]
  },
  "plugins": {
    "updater": {
      "pubkey": "updater pub key",
      "endpoints": ["https://my.app.updater/{{target}}/{{current_version}}"]
    }
  }
}
```

### TOML Format

Enable TOML support in `Cargo.toml`:

```toml
[build-dependencies]
tauri-build = { version = "2.0.0", features = ["config-toml"] }

[dependencies]
tauri = { version = "2.0.0", features = ["config-toml"] }
```

Equivalent TOML configuration:

```toml
[build]
dev-url = "http://localhost:3000"
before-dev-command = "npm run dev"

[bundle]
active = true
icon = ["icons/app.png"]

[[app.windows]]
title = "MyApp"

[plugins.updater]
pubkey = "updater pub key"
endpoints = ["https://my.app.updater/{{target}}/{{current_version}}"]
```

### JSON5 Format

Enable via feature flag `config-json5` instead of `config-toml`.

```toml
[build-dependencies]
tauri-build = { version = "2.0.0", features = ["config-json5"] }

[dependencies]
tauri = { version = "2.0.0", features = ["config-json5"] }
```

### Key Fields Reference

| Field | Purpose |
|-------|---------|
| `productName` | Application display name |
| `version` | Application version |
| `identifier` | Unique app identifier (reverse-domain) |
| `build.devUrl` | Dev server URL |
| `build.beforeDevCommand` | Hook before `tauri dev` |
| `build.beforeBuildCommand` | Hook before `tauri build` |
| `bundle.active` | Enable bundling |
| `bundle.icon` | App icon paths |
| `app.windows` | Window configuration array |
| `plugins` | Plugin settings object |

> Source: https://v2.tauri.app/develop/configuration-files/

---

## Cargo.toml Configuration

Declares Rust dependencies, app metadata, and feature flags.

```toml
[package]
name = "app"
version = "0.1.0"
description = "A Tauri App"
authors = ["you"]
license = ""
repository = ""
default-run = "app"
edition = "2021"
rust-version = "1.57"

[build-dependencies]
tauri-build = { version = "2.0.0" }

[dependencies]
serde_json = "1.0"
serde = { version = "1.0", features = ["derive"] }
tauri = { version = "2.0.0", features = [] }
```

**Version management:**
- `tauri-build` and `tauri` should align with the Tauri CLI version.
- Uses SemVer; `cargo update` pulls the latest compatible version.
- Pin exact versions with `=` prefix: `tauri-build = { version = "=2.0.0" }`.
- The CLI automatically manages `tauri` feature flags based on `tauri.conf.json`.

**Cargo.lock** — Generated during builds. Commit to source control for reproducible builds.

> Source: https://v2.tauri.app/develop/configuration-files/

---

## Platform-Specific Overrides

Tauri reads platform-specific config files that merge into the main config using **JSON Merge Patch (RFC 7396)**:

| Platform | JSON file | TOML file |
|----------|-----------|-----------|
| Linux | `tauri.linux.conf.json` | `Tauri.linux.toml` |
| Windows | `tauri.windows.conf.json` | `Tauri.windows.toml` |
| macOS | `tauri.macos.conf.json` | `Tauri.macos.toml` |
| Android | `tauri.android.conf.json` | `Tauri.android.toml` |
| iOS | `tauri.ios.conf.json` | `Tauri.ios.toml` |

These files live alongside `tauri.conf.json` in `src-tauri/` and only need to contain the fields you want to override.

> Source: https://v2.tauri.app/develop/configuration-files/

---

## Environment Variables and CLI Extensions

### Extending Config at Build/Dev Time

Use `--config` to merge additional configuration (JSON Merge Patch):

```bash
pnpm tauri build --config src-tauri/tauri.beta.conf.json
pnpm tauri dev --config src-tauri/tauri.beta.conf.json
```

Example beta override file:

```json
{
  "productName": "My App Beta",
  "identifier": "com.myorg.myappbeta"
}
```

This is useful for creating separate beta/staging builds without duplicating the full config.

> Source: https://v2.tauri.app/develop/configuration-files/

---

## Build Configuration

### package.json Integration

The frontend's `package.json` defines scripts that Tauri hooks into:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/cli": "^2.0.0"
  }
}
```

These scripts are referenced in `tauri.conf.json`:

```json
{
  "build": {
    "beforeDevCommand": "pnpm dev",
    "beforeBuildCommand": "pnpm build"
  }
}
```

### Build Flow

1. `beforeBuildCommand` runs (compiles frontend to static assets).
2. Rust compiler bundles the static assets into the final binary.
3. Tauri functions like a static web host serving your compiled frontend.

### Lock Files

Commit lock files for reproducible builds:
- `pnpm-lock.yaml` (pnpm)
- `yarn.lock` (Yarn)
- `package-lock.json` (npm)

> Source: https://v2.tauri.app/develop/configuration-files/
