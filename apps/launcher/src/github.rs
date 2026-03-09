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
    context: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    match command_id {
        "github:cmd_hub" => cmd_hub(context).await,
        "github:cmd_repos" => cmd_repos(context).await,
        "github:cmd_prs" => Ok(json!({ "items": [] })),
        "github:cmd_issues" => Ok(json!({ "items": [] })),
        "github:cmd_actions" => Ok(json!({ "items": [] })),
        _ => Err(format!("Unknown github command: {}", command_id)),
    }
}

async fn cmd_repos(context: &serde_json::Value) -> Result<serde_json::Value, String> {
    let query = context["query"].as_str().unwrap_or("").trim().to_string();

    let items = if query.is_empty() {
        let stdout = gh_exec(&[
            "repo",
            "list",
            "--json",
            "name,owner,description,url,isPrivate,stargazerCount,updatedAt",
            "-L",
            "30",
        ])
        .await?;

        let repos: Vec<GhRepo> =
            serde_json::from_str(&stdout).map_err(|e| format!("Failed to parse repos: {}", e))?;

        repos
            .into_iter()
            .map(|r| {
                let full_name = r.full_name();
                let mut accessories = vec![json!({ "text": format!("★ {}", r.stargazer_count) })];
                if r.is_private {
                    accessories.push(json!({ "text": "Private", "tag": "warning" }));
                }
                json!({
                    "id": full_name,
                    "title": r.name,
                    "subtitle": r.description.unwrap_or_default(),
                    "icon": "github",
                    "accessories": accessories,
                    "actions": [{ "type": "url", "url": r.url }]
                })
            })
            .collect::<Vec<_>>()
    } else {
        let stdout = gh_exec(&[
            "search",
            "repos",
            &query,
            "--json",
            "fullName,description,url,stargazerCount",
            "-L",
            "20",
        ])
        .await?;

        let repos: Vec<GhSearchRepo> = serde_json::from_str(&stdout)
            .map_err(|e| format!("Failed to parse search repos: {}", e))?;

        repos
            .into_iter()
            .map(|r| {
                let accessories = vec![json!({ "text": format!("★ {}", r.stargazer_count) })];
                json!({
                    "id": r.full_name,
                    "title": r.full_name,
                    "subtitle": r.description.unwrap_or_default(),
                    "icon": "github",
                    "accessories": accessories,
                    "actions": [{ "type": "url", "url": r.url }]
                })
            })
            .collect::<Vec<_>>()
    };

    Ok(json!({ "items": items }))
}

async fn cmd_hub(context: &serde_json::Value) -> Result<serde_json::Value, String> {
    let query = context["query"].as_str().unwrap_or("").to_lowercase();

    let all_items = vec![
        json!({
            "id": "hub:repos",
            "title": "Repositories",
            "subtitle": "Browse and search GitHub repositories",
            "icon": "github",
            "actions": [{ "type": "push", "command": "github:cmd_repos" }]
        }),
        json!({
            "id": "hub:prs",
            "title": "Pull Requests",
            "subtitle": "View your open pull requests",
            "icon": "github",
            "actions": [{ "type": "push", "command": "github:cmd_prs" }]
        }),
        json!({
            "id": "hub:issues",
            "title": "Issues",
            "subtitle": "View your open issues",
            "icon": "github",
            "actions": [{ "type": "push", "command": "github:cmd_issues" }]
        }),
        json!({
            "id": "hub:actions",
            "title": "Workflow Runs",
            "subtitle": "Monitor CI/CD workflow runs",
            "icon": "github",
            "actions": [{ "type": "push", "command": "github:cmd_actions" }]
        }),
    ];

    let items: Vec<_> = if query.is_empty() {
        all_items
    } else {
        all_items
            .into_iter()
            .filter(|item| {
                item["title"]
                    .as_str()
                    .map(|t| t.to_lowercase().contains(&query))
                    .unwrap_or(false)
            })
            .collect()
    };

    Ok(json!({ "items": items }))
}
