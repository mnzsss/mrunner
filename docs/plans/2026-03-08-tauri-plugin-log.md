# Unified Logging with tauri-plugin-log

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all `println!` (Rust) and `console.*` (JS) with a unified logging system using `tauri-plugin-log`, connected to Sentry for error breadcrumbs.

**Architecture:** `tauri-plugin-log` provides a single logging pipeline for both Rust (`log` crate macros) and JS (`@tauri-apps/plugin-log` functions). Logs route to stdout (dev), log files (prod), and the webview console. Sentry integration uses `sentry` crate's `log` feature on Rust side (auto breadcrumbs for warn/error) and `@sentry/react` already captures console output on JS side.

**Tech Stack:** tauri-plugin-log 2, log crate 0.4, @tauri-apps/plugin-log, sentry (log feature)

---

### Task 1: Install tauri-plugin-log (Rust side)

**Files:**
- Modify: `apps/launcher/Cargo.toml`

**Step 1: Add dependencies**

Add to `[dependencies]` section:

```toml
log = "0.4"
tauri-plugin-log = "2"
```

**Step 2: Add `log` feature to sentry crate**

Change the sentry dependency from:
```toml
sentry = { version = "0.46", default-features = false, features = ["panic", "backtrace", "contexts", "reqwest", "rustls"] }
```
to:
```toml
sentry = { version = "0.46", default-features = false, features = ["panic", "backtrace", "contexts", "reqwest", "rustls", "log"] }
```

**Step 3: Verify it compiles**

Run: `cargo check -p mrunner`
Expected: compiles without errors

**Step 4: Commit**

```
feat: add tauri-plugin-log and log crate dependencies
```

---

### Task 2: Install tauri-plugin-log (JS side)

**Files:**
- Modify: `apps/renderer/package.json` (via pnpm)

**Step 1: Install the JS package**

Run: `pnpm add @tauri-apps/plugin-log --filter @mrunner/renderer`

**Step 2: Commit**

```
feat: add @tauri-apps/plugin-log JS dependency
```

---

### Task 3: Register the log plugin in Tauri builder

**Files:**
- Modify: `apps/launcher/src/lib.rs`

**Step 1: Register plugin in builder**

Add the log plugin BEFORE all other plugins (it must be first so other plugins can use the log crate). In the `run()` function, add after `.manage(...)` and before the other `.plugin(...)` calls:

```rust
.plugin(
    tauri_plugin_log::Builder::new()
        .targets([
            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                file_name: None, // defaults to app name
            }),
        ])
        .level(if cfg!(debug_assertions) {
            log::LevelFilter::Debug
        } else {
            log::LevelFilter::Info
        })
        .build(),
)
```

**Step 2: Verify it compiles**

Run: `cargo check -p mrunner`
Expected: compiles without errors

**Step 3: Commit**

```
feat: register tauri-plugin-log with stdout, webview, and file targets
```

---

### Task 4: Add log permissions to capabilities

**Files:**
- Modify: `apps/launcher/capabilities/default.json`

**Step 1: Add log permission**

Add `"log:default"` to the `permissions` array.

**Step 2: Commit**

```
feat: grant log plugin permissions to main window
```

---

### Task 5: Connect Sentry to log crate on Rust side

**Files:**
- Modify: `apps/launcher/src/sentry.rs`

**Step 1: Add sentry-log integration**

After the `sentry::init(...)` call, add the log integration. The `sentry::integrations::log` module converts `log::warn!` and `log::error!` into Sentry breadcrumbs automatically.

Update the `init()` function to return both the guard and install the logger:

```rust
use sentry::integrations::log::SentryLogger;

pub fn init() -> Option<sentry::ClientInitGuard> {
    // ... existing DSN check code ...

    let guard = sentry::init((
        dsn,
        sentry::ClientOptions {
            // ... existing options ...
            ..Default::default()
        },
    ));

    if guard.is_enabled() {
        // Install SentryLogger to capture warn/error as breadcrumbs
        let logger = SentryLogger::new();
        log::set_boxed_logger(Box::new(logger)).ok();
        log::set_max_level(log::LevelFilter::Debug);
        log::info!("[sentry] Initialized with log integration");
    }

    Some(guard)
}
```

**IMPORTANT:** This `set_boxed_logger` call must happen BEFORE `tauri_plugin_log` registers its own logger. Since Sentry init runs in `main.rs` before `lib::run()`, and tauri-plugin-log registers in the builder, the order should be correct. However, `log` crate only allows ONE global logger. The `tauri-plugin-log` will call `set_logger` too, which will REPLACE the Sentry logger.

**Alternative approach:** Instead of SentryLogger, use tauri-plugin-log as the sole logger and forward errors to Sentry manually. This avoids the conflict. Remove the SentryLogger approach and instead do NOT add the `log` feature to sentry. Keep the existing Sentry setup unchanged. The JS side already captures console.error as Sentry breadcrumbs. For Rust errors, use `sentry::capture_message()` or `sentry::capture_event()` explicitly where needed.

**Revised Step 1: Do NOT change sentry.rs**

Remove the `"log"` feature from sentry in Cargo.toml (revert Task 1 Step 2). The `log` crate global logger slot will be used by `tauri-plugin-log` exclusively. Sentry continues capturing panics and explicit calls. The JS `@sentry/react` already captures console.error/warn as breadcrumbs, and since tauri-plugin-log's Webview target forwards Rust logs to the browser console, Sentry will pick those up too.

**Step 2: Revert sentry `log` feature**

In `apps/launcher/Cargo.toml`, change sentry back to:
```toml
sentry = { version = "0.46", default-features = false, features = ["panic", "backtrace", "contexts", "reqwest", "rustls"] }
```

**Step 3: Commit**

```
refactor: keep sentry separate from log crate to avoid logger conflict
```

---

### Task 6: Initialize logging in JS frontend

**Files:**
- Modify: `apps/renderer/src/main.tsx`

**Step 1: Attach console to log plugin**

Add at the top of `main.tsx`, after `initSentry()`:

```typescript
import { attachConsole } from '@tauri-apps/plugin-log'

attachConsole()
```

This bridges Rust logs (Webview target) to the browser console and routes JS `console.*` calls through the plugin.

**Step 2: Verify**

Run: `pnpm tauri:dev`
Expected: app starts, no errors in console

**Step 3: Commit**

```
feat: attach webview console to tauri-plugin-log
```

---

### Task 7: Create JS logger utility

**Files:**
- Create: `apps/renderer/src/lib/logger.ts`

**Step 1: Create the logger module**

```typescript
import {
  debug as logDebug,
  error as logError,
  info as logInfo,
  warn as logWarn,
} from '@tauri-apps/plugin-log'

function formatMessage(tag: string, message: string): string {
  return `[${tag}] ${message}`
}

function formatArgs(data?: Record<string, unknown>): string {
  if (!data) return ''
  return ` ${JSON.stringify(data)}`
}

export function createLogger(tag: string) {
  return {
    debug(message: string, data?: Record<string, unknown>) {
      void logDebug(formatMessage(tag, message) + formatArgs(data))
    },
    info(message: string, data?: Record<string, unknown>) {
      void logInfo(formatMessage(tag, message) + formatArgs(data))
    },
    warn(message: string, data?: Record<string, unknown>) {
      void logWarn(formatMessage(tag, message) + formatArgs(data))
    },
    error(message: string, data?: Record<string, unknown>) {
      void logError(formatMessage(tag, message) + formatArgs(data))
    },
  }
}
```

**Step 2: Verify lint**

Run: `pnpm check`
Expected: no errors

**Step 3: Commit**

```
feat: create logger utility with createLogger factory
```

---

### Task 8: Replace println! in Rust code

**Files:**
- Modify: `apps/launcher/src/lib.rs` (3 println!)
- Modify: `apps/launcher/src/sentry.rs` (2 println!)
- Modify: `apps/launcher/src/shortcuts.rs` (14 println!)

**Step 1: Replace in lib.rs**

Replace all `println!("[DEBUG] ...")` with `log::debug!(...)` and `println!("[shortcuts] ...")` with `log::warn!(...)`.

Mapping:
- `println!("[DEBUG] run_shell_command called with: {}", command)` → `log::debug!("run_shell_command called with: {}", command)`
- `println!("[DEBUG] Command not allowed: {}", command)` → `log::warn!("Command not allowed: {}", command)`
- `println!("[shortcuts] Failed to load saved shortcuts: {}", e)` → `log::warn!("Failed to load saved shortcuts: {}", e)`

**Step 2: Replace in sentry.rs**

- `println!("[sentry] Skipping...")` → `log::debug!("Sentry: skipping initialization in development (no DSN)")`
- `println!("[sentry] Initialized...")` → `log::info!("Sentry: initialized successfully")`

Note: sentry.rs runs before the log plugin is registered, so these logs may not appear via the plugin. This is acceptable — they'll print to stdout via Rust's default behavior. Alternatively, keep these two as `println!` since they run at startup before the logger is ready.

**Step 3: Replace in shortcuts.rs**

Replace all 14 `println!("[shortcuts] ...")` with appropriate `log::` macros:
- Success messages → `log::info!(...)`
- Debug/trace messages (calling, registering) → `log::debug!(...)`
- Failure messages → `log::warn!(...)`

**Step 4: Verify it compiles**

Run: `cargo check -p mrunner`
Expected: compiles with no errors. May have warnings about unused imports if `println!` was the only output.

**Step 5: Commit**

```
refactor: replace println! with log crate macros across Rust code
```

---

### Task 9: Replace console.* in JS code

**Files (13 files, ~35 instances):**
- Modify: `apps/renderer/src/hooks/use-ai-models.ts`
- Modify: `apps/renderer/src/hooks/use-bookmarks.ts`
- Modify: `apps/renderer/src/hooks/use-commands.ts`
- Modify: `apps/renderer/src/hooks/use-locale.ts`
- Modify: `apps/renderer/src/hooks/use-chrome-profiles.ts`
- Modify: `apps/renderer/src/hooks/use-folder-settings.ts`
- Modify: `apps/renderer/src/hooks/use-plugins.ts`
- Modify: `apps/renderer/src/hooks/use-updater.ts`
- Modify: `apps/renderer/src/hooks/use-shortcuts-settings.ts`
- Modify: `apps/renderer/src/components/bookmark/bookmark-dialog.tsx`
- Modify: `apps/renderer/src/components/settings/settings-sheet.tsx`
- Modify: `apps/renderer/src/components/error-boundary.tsx`
- Modify: `apps/renderer/src/components/folder/folder-manager.tsx`

**Do NOT modify:**
- `apps/renderer/src/lib/sentry.ts` — keep its `console.log` since it runs before the log plugin is ready

**Step 1: Add logger to each file**

At the top of each file, add:
```typescript
import { createLogger } from '@/lib/logger'

const logger = createLogger('<tag>')
```

Where `<tag>` matches the file's domain:
- `use-ai-models.ts` → `'ai-models'`
- `use-bookmarks.ts` → `'bookmarks'`
- `use-commands.ts` → `'commands'`
- `use-locale.ts` → `'locale'`
- `use-chrome-profiles.ts` → `'chrome'`
- `use-folder-settings.ts` → `'folders'`
- `use-plugins.ts` → `'plugins'`
- `use-updater.ts` → `'updater'`
- `use-shortcuts-settings.ts` → `'shortcuts'`
- `bookmark-dialog.tsx` → `'bookmarks'`
- `settings-sheet.tsx` → `'settings'`
- `error-boundary.tsx` → `'error-boundary'`
- `folder-manager.tsx` → `'folders'`

**Step 2: Replace console calls**

Mapping rules:
- `console.debug(...)` → `logger.debug(...)` with structured data
- `console.log(...)` → `logger.info(...)`
- `console.warn(...)` → `logger.warn(...)`
- `console.error('Message:', error)` → `logger.error('message', { error: String(error) })`

Example for `use-ai-models.ts`:
```typescript
// Before:
console.debug('[ai-models] setModel', { slug, activeProvider, typeof: typeof slug })

// After:
logger.debug('setModel', { slug, activeProvider })
```

**Step 3: Verify lint**

Run: `pnpm check`
Expected: no errors

**Step 4: Commit**

```
refactor: replace console.* with structured logger across JS code
```

---

### Task 10: Final verification

**Step 1: Full build check**

Run: `cargo check -p mrunner && pnpm check`
Expected: both pass

**Step 2: Dev smoke test**

Run: `pnpm tauri:dev`
Expected:
- App starts normally
- Open DevTools → Console shows logs with `[tag]` prefixes
- Logs appear in stdout terminal too
- Log file created at `$DATA_LOCAL_DIR/mrunner/logs/`

**Step 3: Commit (if any fixes needed)**

```
fix: address issues from final verification
```
