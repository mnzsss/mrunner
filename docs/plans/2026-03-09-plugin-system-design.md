# MRunner Plugin System Design

## Overview

Design for MRunner's scriptable plugin system. Extends the existing JSON-only plugins with a process-based execution model where plugins are scripts (JS/TS) that run as separate OS processes, communicating with MRunner via JSON stdin/stdout.

**Key decisions:**
- **Execution model:** Process-based (Raycast-inspired) — no embedded JS engine
- **SDK:** `@mrunner/plugin` package with abstract `Command` class
- **Distribution:** Git-based installation from any URL
- **Registry:** `plugins/registry.json` in the main MRunner repo
- **Compatibility:** JSON plugins (tier 1) coexist with scriptable plugins (tier 2)

---

## 1. Plugin Structure

### Tier 1: JSON Plugins (unchanged)

Single `.json` files in the plugins directory. Current format preserved.

```
~/.config/mrunner/plugins/
└── open-claude.json
```

### Tier 2: Scriptable Plugins

A directory with a manifest and command scripts:

```
~/.config/mrunner/plugins/
└── github-repos/
    ├── plugin.json
    ├── package.json
    ├── node_modules/
    └── src/
        └── commands/
            ├── search-repos/
            │   ├── config.json
            │   └── command.ts
            └── create-repo/
                ├── config.json
                └── command.ts
```

### `plugin.json` — Plugin manifest

```json
{
  "$schema": "node_modules/@mrunner/plugin/schemas/plugin.schema.json",
  "id": "github-repos",
  "name": "GitHub Repos",
  "version": "0.1.0",
  "description": "Search and open your GitHub repositories",
  "author": "mnzs",
  "icon": "code",
  "runtime": "node"
}
```

- `$schema` — Points to SDK schema for VS Code IntelliSense
- `runtime` — Interpreter to use (`node`, `deno`, `bun`, `python`, `bash`)
- Commands are auto-discovered from `src/commands/*/config.json`

### `config.json` — Per-command config

```json
{
  "$schema": "node_modules/@mrunner/plugin/schemas/command.schema.json",
  "title": "Search Repositories",
  "description": "Search your GitHub repos by name",
  "icon": "search",
  "mode": "list",
  "keywords": ["github", "repo", "git"]
}
```

- `mode` — Output type: `list` | `detail` | `action`
- `icon` — One of the predefined MRunner icons
- `$schema` — SDK schema for IntelliSense with icon/mode enum values

---

## 2. `@mrunner/plugin` SDK

New package in the monorepo (`packages/plugin/`) providing:

### Abstract Command Class

```typescript
export interface CommandContext {
  query: string;
  preferences: Record<string, unknown>;
  environment: {
    locale: string;
    theme: "light" | "dark";
    platform: "linux" | "windows" | "macos";
    homeDir: string;
  };
}

export interface ListItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  accessories?: Accessory[];
  actions: Action[];
}

export type Action =
  | { type: "url"; url: string; title?: string }
  | { type: "open"; path: string; title?: string }
  | { type: "copy"; content: string; title?: string }
  | { type: "shell"; command: string; title?: string }
  | { type: "notification"; title: string; message: string }
  | { type: "push"; command: string; title?: string };

export interface ListResult { items: ListItem[] }
export interface DetailResult { markdown: string; actions?: Action[] }
export interface ActionResult { action: Action }
export type CommandResult = ListResult | DetailResult | ActionResult;

export abstract class Command {
  abstract run(context: CommandContext): Promise<CommandResult>;
  async onItemSelect?(itemId: string, context: CommandContext): Promise<CommandResult>;
}
```

### Runner (CLI entrypoint)

The package ships a runner that handles stdin/stdout plumbing:

1. Reads stdin JSON (CommandContext)
2. Dynamically imports the command module
3. Instantiates the exported class
4. Calls `run(context)`
5. Writes JSON result to stdout

Plugin authors never touch stdin/stdout — they extend `Command` and implement `run()`.

### JSON Schemas

```
@mrunner/plugin/
├── schemas/
│   ├── plugin.schema.json      ← Schema for plugin.json
│   └── command.schema.json     ← Schema for config.json
```

VS Code picks up `$schema` references automatically. When the SDK version updates, schemas update too — IntelliSense always matches the installed version.

### Example command.ts

```typescript
import { Command, type CommandContext, type ListResult } from "@mrunner/plugin";

export default class SearchRepos extends Command {
  async run(context: CommandContext): Promise<ListResult> {
    const query = context.query.toLowerCase();
    const res = await fetch(`https://api.github.com/search/repositories?q=${query}`);
    const data = await res.json();

    return {
      items: (data.items ?? []).map((repo: any) => ({
        id: repo.id.toString(),
        title: repo.name,
        subtitle: repo.description,
        icon: "code",
        actions: [
          { type: "url", url: repo.html_url, title: "Open in Browser" },
          { type: "copy", content: repo.clone_url, title: "Copy Clone URL" },
        ],
      })),
    };
  }
}
```

---

## 3. Execution Flow

### Plugin Discovery (startup)

```
Rust: scan ~/.config/mrunner/plugins/
  ├── *.json files          → Tier 1 (existing JSON plugin loader)
  └── */plugin.json dirs    → Tier 2 (scan src/commands/*/config.json)
                                 ↓
              Return unified RegisteredPlugin[] to renderer
```

New Tauri command `discover_plugins` replaces the current renderer-side FS reads.

### Command Execution

```
User selects "Search Repositories" in palette
       ↓
invoke('run_plugin_command', { commandId: "github-repos:search-repos", context })
       ↓
Rust spawns: node @mrunner/plugin/runner /path/to/command.ts
       ↓
stdin:  { "query": "react", "environment": { ... } }
       ↓
Script: SearchRepos.run(context) → ListResult
       ↓
stdout: { "items": [...] }
       ↓
Rust validates JSON, returns to renderer via IPC
       ↓
Renderer displays items in CommandPalette
```

- Timeout: 10 seconds (configurable per plugin)
- Stderr is captured for error display/debugging
- Non-zero exit code → error state in palette

### Rendering Modes

| Mode     | Behavior                                                                                        |
| -------- | ----------------------------------------------------------------------------------------------- |
| `list`   | Items shown in CommandPalette. Search input forwards query changes (re-executes with debounce). |
| `detail` | Markdown rendered in a detail panel (reuses Streamdown renderer).                               |
| `action` | Executes immediately, no UI. Shows notification on success.                                     |

### Action Types

| Action         | Effect                             |
| -------------- | ---------------------------------- |
| `url`          | Open URL in default browser        |
| `open`         | Open file/folder in system default |
| `copy`         | Copy text to clipboard             |
| `shell`        | Execute whitelisted shell command  |
| `notification` | Show OS notification               |
| `push`         | Navigate to another plugin command |

---

## 4. Installation & Distribution

### Git-Based Install Flow

```
User enters git URL in Settings → Plugins → "Install Plugin"
       ↓
Rust: git clone <url> → ~/.config/mrunner/plugins/<plugin-id>/
       ↓
Validate plugin.json (exists + valid schema)
       ↓
If package.json exists → run `npm install`
       ↓
Scan src/commands/*/config.json → register commands
       ↓
Plugin ready — shows in Settings + Command Palette
```

### Update Flow

```
Settings → Plugins → "Check for Updates"
       ↓
Rust: git -C <plugin-dir> pull
       ↓
If changes → re-run npm install → re-discover commands → reload
```

### Official Plugin Registry

File: `plugins/registry.json` in the main MRunner repo.

```json
{
  "version": 1,
  "lastUpdated": "2026-03-09T00:00:00Z",
  "plugins": [
    {
      "id": "github-repos",
      "name": "GitHub Repos",
      "description": "Search and open your GitHub repositories",
      "author": "mnzs",
      "icon": "code",
      "repository": "https://github.com/mrunner/plugin-github-repos.git",
      "version": "0.1.0",
      "commands": ["search-repos", "create-repo"],
      "tags": ["github", "git", "developer"],
      "verified": true
    }
  ]
}
```

MRunner fetches this from the raw GitHub URL of the main repo. Cached locally, refreshed on demand or every 24h. Shown in Settings → Plugins → "Browse Plugins" with install buttons.

Community submissions via PR to the main repo.

---

## 5. Security Model

### Layer 1 — Process Isolation
- Each command runs as a separate OS process
- No access to MRunner memory, state, or IPC
- Process killed after timeout (10s default)
- Runs under user's OS permissions

### Layer 2 — Controlled Input
- Only `CommandContext` is sent to stdin (query, locale, theme, platform, homeDir)
- No secrets, tokens, or internal state exposed
- Preferences are scoped per-plugin

### Layer 3 — Output Validation
- Stdout validated against expected JSON schema (Zod)
- Invalid output → error state, not crash
- `shell` actions go through existing `is_command_allowed()` whitelist
- URLs opened via Tauri shell plugin (no raw exec)

### Layer 4 — Install-Time Trust
- On install, MRunner shows: plugin name, author, commands, dependencies, source URL
- User must confirm before installation
- No auto-updates without confirmation
- `verified` flag in registry marks official plugins

---

## 6. Plugin Lifecycle

```
installed → enabled → (command triggered) → running → completed
    ↓          ↓                                ↓
 removed    disabled                         error/timeout
```

State stored in `~/.config/mrunner/preferences.json`:

```json
{
  "plugins": {
    "github-repos": { "enabled": true, "installedAt": "2026-03-09" },
    "docker-tools": { "enabled": false, "installedAt": "2026-03-01" }
  }
}
```

---

## 7. Key Types (Rust side)

```rust
struct RegisteredPlugin {
    plugin_id: String,
    plugin_name: String,
    plugin_icon: String,
    runtime: String,
    commands: Vec<RegisteredCommand>,
    tier: PluginTier,  // Json | Scriptable
}

struct RegisteredCommand {
    id: String,           // "github-repos:search-repos"
    title: String,
    description: String,
    icon: String,
    mode: CommandMode,    // List | Detail | Action
    keywords: Vec<String>,
    script_path: PathBuf,
}
```

---

## 8. UI Changes

### Settings → New "Plugins" Tab

- List installed plugins (name, version, author, status toggle)
- Commands per plugin (expandable)
- "Install from Git URL" input
- "Browse Plugins" section (from registry.json)
- "Open Plugins Folder" button
- "Check for Updates" button

### Command Palette

- Scriptable plugin commands appear grouped by plugin name
- `list` mode: palette shows dynamic results, re-executes on query change
- `detail` mode: renders markdown panel
- `action` mode: immediate execution
- Error/loading states for running scripts

---

## 9. New Packages & Files

| Location                                                | Purpose                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| `packages/plugin/`                                      | `@mrunner/plugin` SDK (Command class, types, runner, schemas) |
| `plugins/registry.json`                                 | Official plugin registry                                      |
| `apps/launcher/src/plugins.rs`                          | Rust: plugin discovery, process spawning, output validation   |
| `apps/renderer/src/hooks/use-plugins.ts`                | Extended: tier 1 + tier 2 loading                             |
| `apps/renderer/src/components/settings/plugins-tab.tsx` | New: plugin management UI                                     |
