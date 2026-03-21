use chrono::{DateTime, Utc};
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
    pub stargazers_count: u64,
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
        "github:cmd_prs" => cmd_prs(context).await,
        "github:cmd_issues" => cmd_issues(context).await,
        "github:cmd_actions" => cmd_actions(context).await,
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
        let search_handle = tokio::spawn(gh_exec_owned(vec![
            "search".to_string(),
            "repos".to_string(),
            query,
            "--json".to_string(),
            "fullName,description,url,stargazersCount".to_string(),
            "-L".to_string(),
            "20".to_string(),
        ]));
        let user_handle = tokio::spawn(gh_exec_owned(vec![
            "api".to_string(),
            "user".to_string(),
            "--jq".to_string(),
            ".login".to_string(),
        ]));

        let stdout = search_handle
            .await
            .map_err(|e| format!("Search task failed: {}", e))??;
        let username = user_handle
            .await
            .map_err(|e| format!("User task failed: {}", e))
            .ok()
            .and_then(|r| r.ok())
            .map(|s| s.trim().to_string())
            .unwrap_or_default();

        let mut repos: Vec<GhSearchRepo> = serde_json::from_str(&stdout)
            .map_err(|e| format!("Failed to parse search repos: {}", e))?;

        if !username.is_empty() {
            let prefix = format!("{}/", username);
            repos.sort_by(|a, b| {
                let a_owned = a.full_name.starts_with(&prefix);
                let b_owned = b.full_name.starts_with(&prefix);
                b_owned.cmp(&a_owned)
            });
        }

        repos
            .into_iter()
            .map(|r| {
                let accessories = vec![json!({ "text": format!("★ {}", r.stargazers_count) })];
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

fn relative_time(date_str: &str) -> String {
    if let Ok(dt) = date_str.parse::<DateTime<Utc>>() {
        let now = Utc::now();
        let diff = now.signed_duration_since(dt);
        let secs = diff.num_seconds();
        if secs < 60 {
            return "just now".to_string();
        }
        let mins = diff.num_minutes();
        if mins < 60 {
            return format!("{}m ago", mins);
        }
        let hours = diff.num_hours();
        if hours < 24 {
            return format!("{}h ago", hours);
        }
        let days = diff.num_days();
        if days < 7 {
            return format!("{}d ago", days);
        }
        let weeks = days / 7;
        if weeks < 4 {
            return format!("{}w ago", weeks);
        }
        let months = days / 30;
        return format!("{}mo ago", months);
    }
    date_str.to_string()
}

async fn cmd_prs(context: &serde_json::Value) -> Result<serde_json::Value, String> {
    let query = context["query"].as_str().unwrap_or("").trim().to_string();

    let mut args = vec![
        "search",
        "prs",
        "--author=@me",
        "--state=open",
        "--json",
        "number,title,repository,url,createdAt",
        "-L",
        "30",
    ];

    let query_owned;
    if !query.is_empty() {
        query_owned = query.clone();
        args.push(&query_owned);
    }

    let stdout = gh_exec(&args).await?;

    let prs: Vec<GhPr> =
        serde_json::from_str(&stdout).map_err(|e| format!("Failed to parse PRs: {}", e))?;

    let items = prs
        .into_iter()
        .map(|pr| {
            let repo = pr.repo_name().to_string();
            let date_text = pr
                .created_at
                .as_deref()
                .map(relative_time)
                .unwrap_or_default();
            json!({
                "id": format!("pr:{}:{}", repo, pr.number),
                "title": pr.title,
                "subtitle": format!("{}#{}", repo, pr.number),
                "icon": "github",
                "accessories": [{ "text": date_text }],
                "actions": [{ "type": "url", "url": pr.url }]
            })
        })
        .collect::<Vec<_>>();

    Ok(json!({ "items": items }))
}

async fn cmd_issues(context: &serde_json::Value) -> Result<serde_json::Value, String> {
    let query = context["query"].as_str().unwrap_or("").trim().to_string();

    let mut args = vec![
        "search",
        "issues",
        "--author=@me",
        "--state=open",
        "--json",
        "number,title,repository,url,createdAt",
        "-L",
        "30",
    ];

    let query_owned;
    if !query.is_empty() {
        query_owned = query.clone();
        args.push(&query_owned);
    }

    let stdout = gh_exec(&args).await?;

    let issues: Vec<GhIssue> =
        serde_json::from_str(&stdout).map_err(|e| format!("Failed to parse issues: {}", e))?;

    let items = issues
        .into_iter()
        .map(|issue| {
            let repo = issue.repo_name().to_string();
            let date_text = issue
                .created_at
                .as_deref()
                .map(relative_time)
                .unwrap_or_default();
            json!({
                "id": format!("issue:{}:{}", repo, issue.number),
                "title": issue.title,
                "subtitle": format!("{}#{}", repo, issue.number),
                "icon": "github",
                "accessories": [{ "text": date_text }],
                "actions": [{ "type": "url", "url": issue.url }]
            })
        })
        .collect::<Vec<_>>();

    Ok(json!({ "items": items }))
}

async fn gh_exec_owned(args: Vec<String>) -> Result<String, String> {
    let output = tokio::process::Command::new("gh")
        .args(&args)
        .output()
        .await
        .map_err(|e| format!("Failed to spawn gh: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

async fn cmd_actions(context: &serde_json::Value) -> Result<serde_json::Value, String> {
    let query = context["query"].as_str().unwrap_or("").to_lowercase();

    let stdout = gh_exec(&["repo", "list", "--json", "nameWithOwner", "-L", "5"]).await?;
    let repos: Vec<GhRepoListItem> = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse repos for actions: {}", e))?;

    let mut handles = Vec::new();
    for repo in repos {
        let repo_name = repo.name_with_owner.clone();
        let handle = tokio::spawn(async move {
            let args = vec![
                "run".to_string(),
                "list".to_string(),
                "--repo".to_string(),
                repo_name.clone(),
                "--json".to_string(),
                "databaseId,displayTitle,status,conclusion,url,createdAt".to_string(),
                "-L".to_string(),
                "3".to_string(),
            ];
            let result = gh_exec_owned(args).await;
            result.map(|stdout| {
                let runs: Vec<GhRun> = serde_json::from_str(&stdout).unwrap_or_default();
                (repo_name, runs)
            })
        });
        handles.push(handle);
    }

    let mut all_runs: Vec<(String, GhRun)> = Vec::new();
    for handle in handles {
        if let Ok(Ok((repo_name, runs))) = handle.await {
            for run in runs {
                all_runs.push((repo_name.clone(), run));
            }
        }
    }

    all_runs.sort_by(|a, b| {
        let a_date = a.1.created_at.as_deref().unwrap_or("");
        let b_date = b.1.created_at.as_deref().unwrap_or("");
        b_date.cmp(a_date)
    });

    let items: Vec<_> = all_runs
        .into_iter()
        .filter(|(repo_name, run)| {
            if query.is_empty() {
                return true;
            }
            run.display_title.to_lowercase().contains(&query)
                || repo_name.to_lowercase().contains(&query)
        })
        .map(|(repo_name, run)| {
            let status_accessory = match run.conclusion.as_deref() {
                Some("success") => json!({ "text": "Passed", "tag": "success" }),
                Some("failure") => json!({ "text": "Failed", "tag": "error" }),
                _ => {
                    if run.status == "in_progress" {
                        json!({ "text": "Running", "tag": "warning" })
                    } else {
                        json!({ "text": run.status })
                    }
                }
            };
            let date_text = run
                .created_at
                .as_deref()
                .map(relative_time)
                .unwrap_or_default();
            json!({
                "id": format!("run:{}", run.database_id),
                "title": run.display_title,
                "subtitle": repo_name,
                "icon": "github",
                "accessories": [status_accessory, { "text": date_text }],
                "actions": [{ "type": "url", "url": run.url }]
            })
        })
        .collect();

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
