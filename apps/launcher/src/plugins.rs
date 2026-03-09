use std::path::PathBuf;

use serde::{Deserialize, Serialize};

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
