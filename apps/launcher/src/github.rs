use serde::Deserialize;
use serde_json::json;
use std::path::PathBuf;

use crate::plugins::{CommandMode, PluginTier, RegisteredCommand, RegisteredPlugin};

// --- gh CLI JSON output structs ---

#[derive(Debug, Deserialize)]
struct GhOwner {
    login: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GhRepo {
    pub name: String,
    owner: GhOwner,
    pub description: Option<String>,
    pub url: String,
    pub is_private: bool,
    pub stargazer_count: u64,
    pub updated_at: Option<String>,
}

impl GhRepo {
    pub fn full_name(&self) -> String {
        format!("{}/{}", self.owner.login, self.name)
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GhSearchRepo {
    pub full_name: String,
    pub description: Option<String>,
    pub url: String,
    pub stargazer_count: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GhPrRepository {
    name_with_owner: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GhPr {
    pub number: u64,
    pub title: String,
    repository: GhPrRepository,
    pub url: String,
    pub created_at: Option<String>,
}

impl GhPr {
    pub fn repo_name(&self) -> &str {
        &self.repository.name_with_owner
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GhIssue {
    pub number: u64,
    pub title: String,
    repository: GhPrRepository,
    pub url: String,
    pub created_at: Option<String>,
}

impl GhIssue {
    pub fn repo_name(&self) -> &str {
        &self.repository.name_with_owner
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GhRun {
    pub database_id: u64,
    pub display_title: String,
    pub status: String,
    pub conclusion: Option<String>,
    pub url: String,
    pub created_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GhRepoListItem {
    pub name_with_owner: String,
}

// --- gh CLI executor ---

pub async fn gh_exec(args: &[&str]) -> Result<String, String> {
    let output = tokio::process::Command::new("gh")
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to spawn gh: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

// --- Plugin registration ---

pub fn register() -> RegisteredPlugin {
    RegisteredPlugin {
        plugin_id: "github".to_string(),
        plugin_name: "GitHub".to_string(),
        plugin_icon: "github".to_string(),
        runtime: "native".to_string(),
        tier: PluginTier::Native,
        plugin_dir: PathBuf::new(),
        commands: vec![
            RegisteredCommand {
                id: "github:cmd_hub".to_string(),
                title: "GitHub".to_string(),
                description: "Browse GitHub repositories, PRs, issues, and workflow runs".to_string(),
                icon: "github".to_string(),
                mode: CommandMode::List,
                keywords: vec!["gh".to_string(), "git".to_string()],
                script_path: None,
            },
            RegisteredCommand {
                id: "github:cmd_repos".to_string(),
                title: "Repositories".to_string(),
                description: "Browse and search GitHub repositories".to_string(),
                icon: "github".to_string(),
                mode: CommandMode::List,
                keywords: vec!["repositories".to_string()],
                script_path: None,
            },
            RegisteredCommand {
                id: "github:cmd_prs".to_string(),
                title: "Pull Requests".to_string(),
                description: "View your open pull requests".to_string(),
                icon: "github".to_string(),
                mode: CommandMode::List,
                keywords: vec!["pull requests".to_string(), "merge".to_string()],
                script_path: None,
            },
            RegisteredCommand {
                id: "github:cmd_issues".to_string(),
                title: "Issues".to_string(),
                description: "View your open issues".to_string(),
                icon: "github".to_string(),
                mode: CommandMode::List,
                keywords: vec!["bugs".to_string(), "tickets".to_string()],
                script_path: None,
            },
            RegisteredCommand {
                id: "github:cmd_actions".to_string(),
                title: "Workflow Runs".to_string(),
                description: "Monitor CI/CD workflow runs".to_string(),
                icon: "github".to_string(),
                mode: CommandMode::List,
                keywords: vec![
                    "ci".to_string(),
                    "cd".to_string(),
                    "workflows".to_string(),
                    "runs".to_string(),
                ],
                script_path: None,
            },
        ],
    }
}

// --- Command dispatch ---

pub async fn run_command(
    command_id: &str,
    _context: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    match command_id {
        "github:cmd_hub" => Ok(json!({ "items": [] })),
        "github:cmd_repos" => Ok(json!({ "items": [] })),
        "github:cmd_prs" => Ok(json!({ "items": [] })),
        "github:cmd_issues" => Ok(json!({ "items": [] })),
        "github:cmd_actions" => Ok(json!({ "items": [] })),
        _ => Err(format!("Unknown github command: {}", command_id)),
    }
}
