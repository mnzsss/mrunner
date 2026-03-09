use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
struct PluginManifest {
    id: String,
    name: String,
    icon: Option<String>,
    runtime: String,
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
    pub script_path: PathBuf,
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
}

pub fn discover_plugins() -> Vec<RegisteredPlugin> {
    let plugins_dir = match dirs::config_dir() {
        Some(d) => d.join("mrunner").join("plugins"),
        None => {
            eprintln!("[plugins] Could not determine config directory");
            return vec![];
        }
    };

    if !plugins_dir.exists() {
        return vec![];
    }

    let entries = match std::fs::read_dir(&plugins_dir) {
        Ok(e) => e,
        Err(err) => {
            eprintln!("[plugins] Failed to read plugins dir: {}", err);
            return vec![];
        }
    };

    let mut plugins = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();

        if path.is_dir() {
            let manifest_path = path.join("plugin.json");
            if manifest_path.exists() {
                if let Some(plugin) = load_scriptable_plugin(&path, &manifest_path) {
                    plugins.push(plugin);
                }
            }
        }
    }

    plugins
}

fn load_scriptable_plugin(plugin_dir: &PathBuf, manifest_path: &PathBuf) -> Option<RegisteredPlugin> {
    let manifest_str = match std::fs::read_to_string(manifest_path) {
        Ok(s) => s,
        Err(err) => {
            eprintln!("[plugins] Failed to read {:?}: {}", manifest_path, err);
            return None;
        }
    };

    let manifest: PluginManifest = match serde_json::from_str(&manifest_str) {
        Ok(m) => m,
        Err(err) => {
            eprintln!("[plugins] Failed to parse {:?}: {}", manifest_path, err);
            return None;
        }
    };

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
    })
}

fn load_commands(plugin_id: &str, commands_dir: &PathBuf) -> Vec<RegisteredCommand> {
    let entries = match std::fs::read_dir(commands_dir) {
        Ok(e) => e,
        Err(err) => {
            eprintln!("[plugins] Failed to read commands dir {:?}: {}", commands_dir, err);
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
                eprintln!("[plugins] Failed to read {:?}: {}", config_path, err);
                continue;
            }
        };

        let config: CommandConfig = match serde_json::from_str(&config_str) {
            Ok(c) => c,
            Err(err) => {
                eprintln!("[plugins] Failed to parse {:?}: {}", config_path, err);
                continue;
            }
        };

        let cmd_name = match cmd_dir.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        let mode = match config.mode.as_deref() {
            Some("detail") => CommandMode::Detail,
            Some("action") => CommandMode::Action,
            _ => CommandMode::List,
        };

        commands.push(RegisteredCommand {
            id: format!("{}:{}", plugin_id, cmd_name),
            title: config.title,
            description: config.description.unwrap_or_default(),
            icon: config.icon.unwrap_or_default(),
            mode,
            keywords: config.keywords.unwrap_or_default(),
            script_path: cmd_dir.join("command.ts"),
        });
    }

    commands
}
