use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

/// Runtimes the plugin runner actually supports. The runner is a Node ESM
/// bundle, so only Node-compatible runtimes are allowed.
const ALLOWED_RUNTIMES: &[&str] = &["node", "deno", "bun"];

/// Maps opaque install tokens (handed to the frontend) to the temp directory
/// created by `prepare_plugin_install`. The frontend never sees real paths.
#[derive(Default)]
pub struct InstallSessions(pub Mutex<HashMap<String, PathBuf>>);

#[derive(Debug, Deserialize)]
struct PluginManifest {
    id: String,
    name: String,
    icon: Option<String>,
    runtime: String,
}

#[derive(Debug, Deserialize)]
struct PluginManifestFull {
    id: String,
    name: String,
    version: String,
    description: Option<String>,
    author: Option<String>,
    icon: Option<String>,
    runtime: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginPreviewInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub author: Option<String>,
    pub icon: Option<String>,
    pub runtime: String,
    pub install_token: String,
}

#[derive(Debug, Deserialize)]
struct CommandConfig {
    title: String,
    description: Option<String>,
    icon: Option<String>,
    mode: Option<String>,
    keywords: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PluginTier {
    Json,
    Scriptable,
    Native,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CommandMode {
    List,
    Detail,
    Action,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisteredCommand {
    pub id: String,
    pub title: String,
    pub description: String,
    pub icon: String,
    pub mode: CommandMode,
    pub keywords: Vec<String>,
    pub script_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisteredPlugin {
    pub plugin_id: String,
    pub plugin_name: String,
    pub plugin_icon: String,
    pub runtime: String,
    pub commands: Vec<RegisteredCommand>,
    pub tier: PluginTier,
    pub plugin_dir: PathBuf,
}

pub fn discover_plugins() -> Vec<RegisteredPlugin> {
    let plugins_dir = match dirs::config_dir() {
        Some(d) => d.join("mrunner").join("plugins"),
        None => {
            log::error!("[plugins] Could not determine config directory");
            return vec![];
        }
    };

    if !plugins_dir.exists() {
        return vec![];
    }

    let entries = match std::fs::read_dir(&plugins_dir) {
        Ok(e) => e,
        Err(err) => {
            log::error!("[plugins] Failed to read plugins dir: {}", err);
            return vec![];
        }
    };

    let mut plugins = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();

        // Skip hidden dirs (including in-progress `.installing-*` clones)
        if path
            .file_name()
            .and_then(|n| n.to_str())
            .is_some_and(|n| n.starts_with('.'))
        {
            continue;
        }

        if path.is_dir() {
            let manifest_path = path.join("plugin.json");
            if manifest_path.exists() {
                if let Some(plugin) = load_scriptable_plugin(&path, &manifest_path) {
                    plugins.push(plugin);
                }
            }
        }
    }

    plugins.push(crate::github::register());

    plugins
}

fn load_scriptable_plugin(plugin_dir: &PathBuf, manifest_path: &PathBuf) -> Option<RegisteredPlugin> {
    let manifest_str = match std::fs::read_to_string(manifest_path) {
        Ok(s) => s,
        Err(err) => {
            log::warn!("[plugins] Failed to read {:?}: {}", manifest_path, err);
            return None;
        }
    };

    let manifest: PluginManifest = match serde_json::from_str(&manifest_str) {
        Ok(m) => m,
        Err(err) => {
            log::warn!("[plugins] Failed to parse {:?}: {}", manifest_path, err);
            return None;
        }
    };

    if let Err(err) = validate_runtime(&manifest.runtime) {
        log::warn!("[plugins] Skipping plugin '{}': {}", manifest.id, err);
        return None;
    }

    let commands_dir = plugin_dir.join("src").join("commands");
    let commands = if commands_dir.exists() {
        load_commands(&manifest.id, &commands_dir)
    } else {
        vec![]
    };

    Some(RegisteredPlugin {
        plugin_id: manifest.id,
        plugin_name: manifest.name,
        plugin_icon: manifest.icon.unwrap_or_default(),
        runtime: manifest.runtime,
        commands,
        tier: PluginTier::Scriptable,
        plugin_dir: plugin_dir.clone(),
    })
}

fn load_commands(plugin_id: &str, commands_dir: &PathBuf) -> Vec<RegisteredCommand> {
    let entries = match std::fs::read_dir(commands_dir) {
        Ok(e) => e,
        Err(err) => {
            log::warn!("[plugins] Failed to read commands dir {:?}: {}", commands_dir, err);
            return vec![];
        }
    };

    let mut commands = Vec::new();

    for entry in entries.flatten() {
        let cmd_dir = entry.path();
        if !cmd_dir.is_dir() {
            continue;
        }

        let config_path = cmd_dir.join("config.json");
        if !config_path.exists() {
            continue;
        }

        let config_str = match std::fs::read_to_string(&config_path) {
            Ok(s) => s,
            Err(err) => {
                log::warn!("[plugins] Failed to read {:?}: {}", config_path, err);
                continue;
            }
        };

        let config: CommandConfig = match serde_json::from_str(&config_str) {
            Ok(c) => c,
            Err(err) => {
                log::warn!("[plugins] Failed to parse {:?}: {}", config_path, err);
                continue;
            }
        };

        let cmd_name = match cmd_dir.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        // `mode` is required by command.schema.json — reject configs that omit
        // it or use an unknown value instead of silently defaulting.
        let mode = match config.mode.as_deref() {
            Some("list") => CommandMode::List,
            Some("detail") => CommandMode::Detail,
            Some("action") => CommandMode::Action,
            other => {
                log::warn!(
                    "[plugins] Skipping command {:?}: invalid or missing mode {:?} (expected list, detail, or action)",
                    config_path,
                    other
                );
                continue;
            }
        };

        commands.push(RegisteredCommand {
            id: format!("{}:{}", plugin_id, cmd_name),
            title: config.title,
            description: config.description.unwrap_or_default(),
            icon: config.icon.unwrap_or_default(),
            mode,
            keywords: config.keywords.unwrap_or_default(),
            script_path: Some(cmd_dir.join("command.ts")),
        });
    }

    commands
}

pub fn find_command<'a>(
    plugins: &'a [RegisteredPlugin],
    command_id: &str,
) -> Option<(&'a RegisteredPlugin, &'a RegisteredCommand)> {
    for plugin in plugins {
        for command in &plugin.commands {
            if command.id == command_id {
                return Some((plugin, command));
            }
        }
    }
    None
}

fn resolve_runner_path(plugin_dir: &PathBuf) -> Result<PathBuf, String> {
    let local = plugin_dir
        .join("node_modules")
        .join("@mrunner")
        .join("plugin")
        .join("dist")
        .join("runner.js");
    if local.exists() {
        return Ok(local);
    }
    Err(format!(
        "runner.js not found at {:?} — run `npm install` inside the plugin directory",
        local
    ))
}

pub async fn run_plugin_command(
    plugin: &RegisteredPlugin,
    command: &RegisteredCommand,
    context: serde_json::Value,
    method: Option<String>,
    item_id: Option<String>,
) -> Result<serde_json::Value, String> {
    if matches!(plugin.tier, PluginTier::Native) {
        return crate::github::run_command(&command.id, &context).await;
    }

    validate_runtime(&plugin.runtime)?;

    let method = method.unwrap_or_else(|| "run".to_string());
    if method != "run" && method != "onItemSelect" {
        return Err(format!("Invalid plugin method '{}'", method));
    }

    let runner_path = resolve_runner_path(&plugin.plugin_dir)?;
    let script_path = command
        .script_path
        .as_ref()
        .ok_or_else(|| format!("Plugin command '{}' has no script_path (native commands are not executed here)", command.id))?;
    let context_json = serde_json::to_string(&context).map_err(|e| e.to_string())?;

    let mut cmd = tokio::process::Command::new(&plugin.runtime);
    cmd.arg(&runner_path).arg(script_path).arg(&method);
    if let Some(ref id) = item_id {
        cmd.arg(id);
    }
    let mut child = cmd
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn {} process: {}", plugin.runtime, e))?;

    // Write context JSON to stdin concurrently with reading, so a payload
    // larger than the pipe buffer cannot deadlock the child.
    if let Some(mut stdin) = child.stdin.take() {
        tokio::spawn(async move {
            if let Err(e) = stdin.write_all(context_json.as_bytes()).await {
                log::warn!("[plugins] Failed to write context to plugin stdin: {}", e);
            }
            // stdin is dropped (closed) here
        });
    }

    // Extract stdout/stderr handles, then spawn concurrent tasks (both run while timeout is active)
    let mut stdout_handle = child.stdout.take().expect("stdout was piped");
    let mut stderr_handle = child.stderr.take().expect("stderr was piped");

    let stdout_task = tokio::spawn(async move {
        let mut buf = Vec::new();
        stdout_handle.read_to_end(&mut buf).await.ok();
        buf
    });
    let stderr_task = tokio::spawn(async move {
        let mut buf = Vec::new();
        stderr_handle.read_to_end(&mut buf).await.ok();
        buf
    });

    let read_future = async {
        let stdout_buf = stdout_task.await.unwrap_or_default();
        let stderr_buf = stderr_task.await.unwrap_or_default();
        (stdout_buf, stderr_buf)
    };

    let timeout_result = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        read_future,
    )
    .await;

    match timeout_result {
        Err(_) => {
            let _ = child.kill().await;
            // Reap the killed child so it doesn't linger as a zombie
            let _ = child.wait().await;
            Err(format!("Plugin command '{}' timed out after 10 seconds", command.id))
        }
        Ok((stdout_buf, stderr_buf)) => {
            let status = child
                .wait()
                .await
                .map_err(|e| format!("Failed to wait for process: {}", e))?;

            if !status.success() {
                let stderr = String::from_utf8_lossy(&stderr_buf).to_string();
                return Err(format!(
                    "Plugin command '{}' exited with status {}: {}",
                    command.id,
                    status.code().unwrap_or(-1),
                    stderr
                ));
            }
            let stdout = String::from_utf8_lossy(&stdout_buf);
            serde_json::from_str::<serde_json::Value>(stdout.trim())
                .map_err(|e| format!("Failed to parse plugin output as JSON: {}", e))
        }
    }
}

/// Validates that the runtime is one of the allowed, runner-compatible runtimes.
fn validate_runtime(runtime: &str) -> Result<(), String> {
    if ALLOWED_RUNTIMES.contains(&runtime) {
        Ok(())
    } else {
        Err(format!(
            "Unsupported runtime '{}': allowed runtimes are {}",
            runtime,
            ALLOWED_RUNTIMES.join(", ")
        ))
    }
}

/// Validates that a git URL uses an authenticated/encrypted scheme (https, ssh)
/// and does not start with `-` (argument injection). Cleartext transports
/// (http, git) are rejected because cloned code is later executed.
fn validate_git_url(url: &str) -> Result<(), String> {
    let url = url.trim();
    if url.starts_with('-') {
        return Err("Invalid git URL: must not start with '-'".to_string());
    }
    let allowed_schemes = ["https://", "ssh://", "git@"];
    if !allowed_schemes.iter().any(|s| url.starts_with(s)) {
        return Err(
            "Invalid git URL scheme — only https and ssh protocols are allowed".to_string(),
        );
    }
    Ok(())
}

/// Validates that a plugin id contains only safe characters (alphanumeric, hyphens, underscores).
fn validate_plugin_id(id: &str) -> Result<(), String> {
    if id.is_empty() {
        return Err("Plugin id must not be empty".to_string());
    }
    if !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err(format!(
            "Invalid plugin id '{}': must contain only alphanumeric characters, hyphens, and underscores",
            id
        ));
    }
    Ok(())
}

/// Validates that a path resides within the expected plugins base directory.
fn validate_temp_path(temp_path: &str) -> Result<PathBuf, String> {
    let plugins_base = dirs::config_dir()
        .ok_or("Could not find config directory")?
        .join("mrunner")
        .join("plugins");
    validate_temp_path_in(&plugins_base, temp_path)
}

/// Testable core of `validate_temp_path`: checks that `temp_path` canonicalizes
/// to a `.installing-*` directory inside `plugins_base`.
fn validate_temp_path_in(plugins_base: &PathBuf, temp_path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(temp_path);
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("Invalid temp path: {}", e))?;
    let canonical_base = plugins_base
        .canonicalize()
        .map_err(|e| format!("Plugins directory not found: {}", e))?;

    if !canonical.starts_with(&canonical_base) {
        return Err("Temp path is outside the plugins directory".to_string());
    }

    let dir_name = canonical
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");
    if !dir_name.starts_with(".installing-") {
        return Err("Temp path does not match expected .installing-* pattern".to_string());
    }

    Ok(canonical)
}

/// Resolves and removes an install token from the session map, returning the
/// validated temp directory it points to.
fn take_install_session(
    sessions: &InstallSessions,
    install_token: &str,
) -> Result<PathBuf, String> {
    let path = sessions
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .remove(install_token)
        .ok_or("Unknown or expired install token")?;
    // Defense in depth: the stored path is server-generated, but re-validate
    // before any destructive operation.
    validate_temp_path(&path.to_string_lossy())
}

/// Clones the repository to a temporary directory inside the plugins folder and
/// returns a preview of the plugin manifest so the user can confirm before
/// installation. The temp directory is keyed by an opaque install token stored
/// in `sessions`; the frontend only ever sees the token.
pub fn prepare_plugin_install(
    sessions: &InstallSessions,
    git_url: &str,
) -> Result<PluginPreviewInfo, String> {
    validate_git_url(git_url)?;

    let plugins_base = dirs::config_dir()
        .ok_or("Could not find config directory")?
        .join("mrunner")
        .join("plugins");

    std::fs::create_dir_all(&plugins_base)
        .map_err(|e| format!("Failed to create plugins directory: {}", e))?;

    // Unique temp dir on the same filesystem to avoid cross-device rename later
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let temp_dir = plugins_base.join(format!(".installing-{}", ts));

    let status = std::process::Command::new("git")
        .arg("clone")
        .arg("--")
        .arg(git_url)
        .arg(&temp_dir)
        .status()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if !status.success() {
        let _ = std::fs::remove_dir_all(&temp_dir);
        return Err(format!("git clone failed for URL: {}", git_url));
    }

    let manifest_path = temp_dir.join("plugin.json");
    if !manifest_path.exists() {
        let _ = std::fs::remove_dir_all(&temp_dir);
        return Err("No plugin.json found in the repository root".to_string());
    }

    let content = std::fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read plugin.json: {}", e))?;

    let manifest: PluginManifestFull = serde_json::from_str(&content).map_err(|e| {
        let _ = std::fs::remove_dir_all(&temp_dir);
        format!("Invalid plugin.json: {}", e)
    })?;

    if let Err(e) = validate_plugin_id(&manifest.id) {
        let _ = std::fs::remove_dir_all(&temp_dir);
        return Err(e);
    }
    if let Err(e) = validate_runtime(&manifest.runtime) {
        let _ = std::fs::remove_dir_all(&temp_dir);
        return Err(e);
    }

    let install_token = format!("install-{}-{}", ts, std::process::id());
    sessions
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .insert(install_token.clone(), temp_dir);

    Ok(PluginPreviewInfo {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        icon: manifest.icon,
        runtime: manifest.runtime,
        install_token,
    })
}

/// Moves the previously cloned temp directory to its final location and runs
/// npm install. Note: npm install executes package lifecycle scripts from the
/// cloned repository — the user confirms this in the install dialog.
pub fn complete_plugin_install(
    sessions: &InstallSessions,
    install_token: &str,
) -> Result<(), String> {
    let temp_dir = take_install_session(sessions, install_token)?;

    let manifest_path = temp_dir.join("plugin.json");
    let content = std::fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read plugin.json: {}", e))?;
    let manifest: PluginManifest = serde_json::from_str(&content)
        .map_err(|e| format!("Invalid plugin.json: {}", e))?;

    validate_plugin_id(&manifest.id)?;

    let final_dir = dirs::config_dir()
        .ok_or("Could not find config directory")?
        .join("mrunner")
        .join("plugins")
        .join(&manifest.id);

    if final_dir.exists() {
        let _ = std::fs::remove_dir_all(&temp_dir);
        return Err(format!("Plugin '{}' is already installed", manifest.id));
    }

    std::fs::rename(&temp_dir, &final_dir).map_err(|e| {
        let _ = std::fs::remove_dir_all(&temp_dir);
        format!("Failed to move plugin directory: {}", e)
    })?;

    if final_dir.join("package.json").exists() {
        let status = std::process::Command::new("npm")
            .arg("install")
            .current_dir(&final_dir)
            .status()
            .map_err(|e| {
                let _ = std::fs::remove_dir_all(&final_dir);
                format!("Failed to run npm install: {}", e)
            })?;

        if !status.success() {
            let _ = std::fs::remove_dir_all(&final_dir);
            return Err("npm install failed".to_string());
        }
    }

    Ok(())
}

/// Cleans up a temporary install directory (used when the user cancels).
pub fn cancel_plugin_install(
    sessions: &InstallSessions,
    install_token: &str,
) -> Result<(), String> {
    let validated = take_install_session(sessions, install_token)?;
    let _ = std::fs::remove_dir_all(validated);
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateResult {
    pub plugin_id: String,
    pub plugin_name: String,
    pub status: String,
    pub message: Option<String>,
}

fn git_in(dir: &PathBuf, args: &[&str]) -> Result<std::process::Output, String> {
    std::process::Command::new("git")
        .arg("-C")
        .arg(dir)
        .args(args)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))
}

/// Checks for available updates in each installed Tier 2 plugin directory.
/// Read-only: runs `git fetch` and compares HEAD against the upstream branch.
/// No code is pulled or executed — applying an update requires an explicit
/// `update_plugin` call per plugin.
pub fn check_plugin_updates(plugins: &[RegisteredPlugin]) -> Vec<UpdateResult> {
    let mut results = Vec::new();

    for plugin in plugins {
        if !matches!(plugin.tier, PluginTier::Scriptable) {
            continue;
        }

        let dir = &plugin.plugin_dir;
        let mut result = UpdateResult {
            plugin_id: plugin.plugin_id.clone(),
            plugin_name: plugin.plugin_name.clone(),
            status: "skipped".to_string(),
            message: Some("Not a git repository".to_string()),
        };

        if dir.join(".git").exists() {
            result = match check_one_plugin_update(dir) {
                Ok(update_available) => UpdateResult {
                    plugin_id: plugin.plugin_id.clone(),
                    plugin_name: plugin.plugin_name.clone(),
                    status: if update_available {
                        "update-available"
                    } else {
                        "up-to-date"
                    }
                    .to_string(),
                    message: None,
                },
                Err(e) => UpdateResult {
                    plugin_id: plugin.plugin_id.clone(),
                    plugin_name: plugin.plugin_name.clone(),
                    status: "error".to_string(),
                    message: Some(e),
                },
            };
        }

        results.push(result);
    }

    results
}

fn check_one_plugin_update(dir: &PathBuf) -> Result<bool, String> {
    let fetch = git_in(dir, &["fetch", "--quiet"])?;
    if !fetch.status.success() {
        return Err(String::from_utf8_lossy(&fetch.stderr).to_string());
    }

    let local = git_in(dir, &["rev-parse", "HEAD"])?;
    let upstream = git_in(dir, &["rev-parse", "@{u}"])?;
    if !local.status.success() || !upstream.status.success() {
        return Err("Could not resolve local or upstream revision".to_string());
    }

    Ok(local.stdout != upstream.stdout)
}

/// Applies a pending update for a single plugin: `git pull` followed by
/// `npm install` when a package.json is present. Must only be called from an
/// explicit user action — pulled code (and npm lifecycle scripts) execute on
/// the user's machine.
pub fn update_plugin(plugins: &[RegisteredPlugin], plugin_id: &str) -> Result<UpdateResult, String> {
    validate_plugin_id(plugin_id)?;

    let plugin = plugins
        .iter()
        .find(|p| p.plugin_id == plugin_id && matches!(p.tier, PluginTier::Scriptable))
        .ok_or_else(|| format!("Plugin '{}' is not an installed scriptable plugin", plugin_id))?;

    let dir = &plugin.plugin_dir;
    if !dir.join(".git").exists() {
        return Err(format!("Plugin '{}' is not a git repository", plugin_id));
    }

    let pull = git_in(dir, &["pull", "--ff-only"])?;
    if !pull.status.success() {
        return Ok(UpdateResult {
            plugin_id: plugin.plugin_id.clone(),
            plugin_name: plugin.plugin_name.clone(),
            status: "error".to_string(),
            message: Some(String::from_utf8_lossy(&pull.stderr).to_string()),
        });
    }

    let stdout = String::from_utf8_lossy(&pull.stdout);
    let updated = !stdout.contains("Already up to date");

    if updated && dir.join("package.json").exists() {
        let npm_status = std::process::Command::new("npm")
            .arg("install")
            .current_dir(dir)
            .status();

        match npm_status {
            Ok(s) if s.success() => {}
            Ok(_) => {
                return Ok(UpdateResult {
                    plugin_id: plugin.plugin_id.clone(),
                    plugin_name: plugin.plugin_name.clone(),
                    status: "error".to_string(),
                    message: Some("Updated but npm install failed".to_string()),
                });
            }
            Err(e) => {
                return Ok(UpdateResult {
                    plugin_id: plugin.plugin_id.clone(),
                    plugin_name: plugin.plugin_name.clone(),
                    status: "error".to_string(),
                    message: Some(format!("Updated but npm install failed: {}", e)),
                });
            }
        }
    }

    Ok(UpdateResult {
        plugin_id: plugin.plugin_id.clone(),
        plugin_name: plugin.plugin_name.clone(),
        status: if updated { "updated" } else { "up-to-date" }.to_string(),
        message: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn git_url_accepts_https_ssh_and_scp_forms() {
        assert!(validate_git_url("https://github.com/user/repo.git").is_ok());
        assert!(validate_git_url("ssh://git@github.com/user/repo.git").is_ok());
        assert!(validate_git_url("git@github.com:user/repo.git").is_ok());
        assert!(validate_git_url("  https://github.com/user/repo  ").is_ok());
    }

    #[test]
    fn git_url_rejects_cleartext_and_exotic_transports() {
        assert!(validate_git_url("http://github.com/user/repo.git").is_err());
        assert!(validate_git_url("git://github.com/user/repo.git").is_err());
        assert!(validate_git_url("ext::sh -c whoami").is_err());
        assert!(validate_git_url("file:///etc/passwd").is_err());
        assert!(validate_git_url("/local/path").is_err());
        assert!(validate_git_url("").is_err());
    }

    #[test]
    fn git_url_rejects_argument_injection() {
        assert!(validate_git_url("--upload-pack=touch${IFS}pwned").is_err());
        assert!(validate_git_url("-c core.fsmonitor=evil").is_err());
    }

    #[test]
    fn plugin_id_accepts_safe_characters() {
        assert!(validate_plugin_id("my-plugin").is_ok());
        assert!(validate_plugin_id("plugin_2").is_ok());
        assert!(validate_plugin_id("ABC123").is_ok());
    }

    #[test]
    fn plugin_id_rejects_traversal_and_separators() {
        assert!(validate_plugin_id("").is_err());
        assert!(validate_plugin_id("../../etc").is_err());
        assert!(validate_plugin_id("a/b").is_err());
        assert!(validate_plugin_id("a\\b").is_err());
        assert!(validate_plugin_id("a b").is_err());
        assert!(validate_plugin_id(".hidden").is_err());
        assert!(validate_plugin_id("name;rm -rf").is_err());
    }

    #[test]
    fn runtime_allows_only_node_compatible_runtimes() {
        assert!(validate_runtime("node").is_ok());
        assert!(validate_runtime("deno").is_ok());
        assert!(validate_runtime("bun").is_ok());
        assert!(validate_runtime("python").is_err());
        assert!(validate_runtime("bash").is_err());
        assert!(validate_runtime("/usr/bin/evil").is_err());
        assert!(validate_runtime("").is_err());
    }

    struct TempBase(PathBuf);

    impl TempBase {
        fn new(tag: &str) -> Self {
            let base = std::env::temp_dir().join(format!(
                "mrunner-test-{}-{}",
                tag,
                std::process::id()
            ));
            let _ = std::fs::remove_dir_all(&base);
            std::fs::create_dir_all(&base).unwrap();
            Self(base)
        }
    }

    impl Drop for TempBase {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn temp_path_accepts_installing_dir_inside_base() {
        let base = TempBase::new("ok");
        let dir = base.0.join(".installing-123");
        std::fs::create_dir_all(&dir).unwrap();

        let result = validate_temp_path_in(&base.0, &dir.to_string_lossy());
        assert!(result.is_ok());
    }

    #[test]
    fn temp_path_rejects_paths_outside_base() {
        let base = TempBase::new("outside");
        let outside = std::env::temp_dir().join(format!(
            ".installing-outside-{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&outside).unwrap();

        let result = validate_temp_path_in(&base.0, &outside.to_string_lossy());
        let _ = std::fs::remove_dir_all(&outside);
        assert!(result.is_err());
    }

    #[test]
    fn temp_path_rejects_traversal_escapes() {
        let base = TempBase::new("traversal");
        let dir = base.0.join(".installing-123");
        std::fs::create_dir_all(&dir).unwrap();

        let sneaky = format!("{}/.installing-123/../..", base.0.to_string_lossy());
        assert!(validate_temp_path_in(&base.0, &sneaky).is_err());
    }

    #[test]
    fn temp_path_rejects_non_installing_dirs() {
        let base = TempBase::new("pattern");
        let dir = base.0.join("regular-plugin");
        std::fs::create_dir_all(&dir).unwrap();

        let result = validate_temp_path_in(&base.0, &dir.to_string_lossy());
        assert!(result.is_err());
    }

    #[test]
    fn temp_path_rejects_nonexistent_paths() {
        let base = TempBase::new("missing");
        let missing = base.0.join(".installing-does-not-exist");
        assert!(validate_temp_path_in(&base.0, &missing.to_string_lossy()).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn temp_path_rejects_symlink_to_installed_plugin() {
        let base = TempBase::new("symlink");
        let real_plugin = base.0.join("installed-plugin");
        std::fs::create_dir_all(&real_plugin).unwrap();
        let link = base.0.join(".installing-link");
        std::os::unix::fs::symlink(&real_plugin, &link).unwrap();

        // Canonicalization resolves the symlink to `installed-plugin`, which
        // fails the `.installing-*` name check — protecting the real plugin
        // from deletion.
        assert!(validate_temp_path_in(&base.0, &link.to_string_lossy()).is_err());
    }

    #[test]
    fn take_install_session_rejects_unknown_tokens() {
        let sessions = InstallSessions::default();
        assert!(take_install_session(&sessions, "no-such-token").is_err());
    }
}
