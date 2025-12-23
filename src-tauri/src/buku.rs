use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bookmark {
    pub index: i32,
    pub uri: String,
    pub title: String,
    pub tags: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub name: String,
    pub count: i32,
}

const MAX_INPUT_LENGTH: usize = 2048;
const FORBIDDEN_CHARS: &[char] = &[';', '&', '|', '$', '`', '(', ')', '<', '>', '\n', '\r', '\0'];

fn sanitize_input(input: &str) -> Result<String, String> {
    if input.len() > MAX_INPUT_LENGTH {
        return Err(format!("Input exceeds maximum length of {} characters", MAX_INPUT_LENGTH));
    }

    if input.chars().any(|c| FORBIDDEN_CHARS.contains(&c)) {
        return Err("Input contains forbidden characters".to_string());
    }

    Ok(input.to_string())
}

fn parse_buku_json(output: &[u8]) -> Vec<Bookmark> {
    let json = String::from_utf8_lossy(output);
    serde_json::from_str(&json).unwrap_or_default()
}

#[tauri::command]
pub fn buku_list(limit: Option<i32>) -> Result<Vec<Bookmark>, String> {
    let output = Command::new("buku")
        .args(["--nostdin", "--np", "-p", "-j"])
        .output()
        .map_err(|e| format!("Failed to execute buku: {}", e))?;

    if output.status.success() {
        let mut bookmarks = parse_buku_json(&output.stdout);

        if let Some(n) = limit {
            let len = bookmarks.len();
            if len > n as usize {
                bookmarks = bookmarks.split_off(len - n as usize);
            }
        }

        Ok(bookmarks)
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub fn buku_search(
    query: String,
    #[allow(non_snake_case)] tagFilter: Option<String>,
    #[allow(non_snake_case)] tagOr: Option<bool>,
) -> Result<Vec<Bookmark>, String> {
    if query.is_empty() && tagFilter.is_none() {
        return buku_list(None);
    }

    let sanitized_query = if !query.is_empty() {
        sanitize_input(&query)?
    } else {
        String::new()
    };

    let sanitized_tags = if let Some(ref tags) = tagFilter {
        Some(sanitize_input(tags)?)
    } else {
        None
    };

    let mut cmd = Command::new("buku");
    cmd.args(["--nostdin", "--np"]);

    if let Some(ref tags) = sanitized_tags {
        cmd.args(["--stag", tags]);
        if tagOr.unwrap_or(false) {
            cmd.arg("--or");
        }
    }

    if !sanitized_query.is_empty() {
        cmd.args(["-s", &sanitized_query]);
    }

    cmd.arg("-j");

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to execute buku: {}", e))?;

    if output.status.success() {
        Ok(parse_buku_json(&output.stdout))
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub fn buku_get_by_id(id: i32) -> Result<Option<Bookmark>, String> {
    let output = Command::new("buku")
        .args(["--nostdin", "--np", "-p", &id.to_string(), "-j"])
        .output()
        .map_err(|e| format!("Failed to execute buku: {}", e))?;

    if output.status.success() {
        let bookmarks = parse_buku_json(&output.stdout);
        Ok(bookmarks.into_iter().next())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub fn buku_open(id: i32) -> Result<(), String> {
    let output = Command::new("buku")
        .args(["--nostdin", "--np", "-o", &id.to_string()])
        .output()
        .map_err(|e| format!("Failed to open bookmark: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub fn buku_add(
    url: String,
    title: Option<String>,
    tags: Option<String>,
    description: Option<String>,
) -> Result<(), String> {
    let sanitized_url = sanitize_input(&url)?;
    let sanitized_title = title.map(|t| sanitize_input(&t)).transpose()?;
    let sanitized_tags = tags.map(|t| sanitize_input(&t)).transpose()?;
    let sanitized_desc = description.map(|d| sanitize_input(&d)).transpose()?;

    let mut cmd = Command::new("buku");
    cmd.args(["--nostdin", "--np", "-a", &sanitized_url]);

    if let Some(ref t) = sanitized_title {
        cmd.args(["--title", t]);
    }

    if let Some(ref tg) = sanitized_tags {
        cmd.args(["--tag", tg]);
    }

    if let Some(ref d) = sanitized_desc {
        cmd.args(["-c", d]);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to add bookmark: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub fn buku_update(
    id: i32,
    url: Option<String>,
    title: Option<String>,
    tags: Option<String>,
    description: Option<String>,
) -> Result<(), String> {
    let sanitized_url = url.map(|u| sanitize_input(&u)).transpose()?;
    let sanitized_title = title.map(|t| sanitize_input(&t)).transpose()?;
    let sanitized_tags = tags.map(|t| sanitize_input(&t)).transpose()?;
    let sanitized_desc = description.map(|d| sanitize_input(&d)).transpose()?;

    let mut cmd = Command::new("buku");
    cmd.args(["--nostdin", "--np", "-u", &id.to_string()]);

    if let Some(ref u) = sanitized_url {
        cmd.args(["--url", u]);
    }

    if let Some(ref t) = sanitized_title {
        cmd.args(["--title", t]);
    }

    if let Some(ref tg) = sanitized_tags {
        cmd.args(["--tag", tg]);
    }

    if let Some(ref d) = sanitized_desc {
        cmd.args(["-c", d]);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to update bookmark: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub fn buku_delete(id: i32) -> Result<(), String> {
    let output = Command::new("buku")
        .args(["--nostdin", "--np", "--tacit", "-d", &id.to_string()])
        .output()
        .map_err(|e| format!("Failed to delete bookmark: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub fn buku_list_tags() -> Result<Vec<Tag>, String> {
    let output = Command::new("buku")
        .args(["--nostdin", "--np", "--stag"])
        .output()
        .map_err(|e| format!("Failed to list tags: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let tags: Vec<Tag> = stdout
            .lines()
            .filter_map(|line| {
                let line = line.trim();
                if let Some(dot_pos) = line.find('.') {
                    let rest = line[dot_pos + 1..].trim();
                    if let Some(paren_pos) = rest.rfind('(') {
                        let name = rest[..paren_pos].trim().to_string();
                        let count_str = rest[paren_pos + 1..].trim_end_matches(')');
                        if let Ok(count) = count_str.parse::<i32>() {
                            return Some(Tag { name, count });
                        }
                    }
                }
                None
            })
            .collect();
        Ok(tags)
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub fn buku_rename_tag(old_tag: String, new_tag: String) -> Result<(), String> {
    let sanitized_old = sanitize_input(&old_tag)?;
    let sanitized_new = sanitize_input(&new_tag)?;

    let output = Command::new("buku")
        .args([
            "--nostdin",
            "--np",
            "-r",
            &format!("{},{}", sanitized_old, sanitized_new),
        ])
        .output()
        .map_err(|e| format!("Failed to rename tag: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub fn buku_delete_tag(tag: String) -> Result<(), String> {
    let sanitized_tag = sanitize_input(&tag)?;

    let output = Command::new("buku")
        .args(["--nostdin", "--np", "-r", &format!("{},", sanitized_tag)])
        .output()
        .map_err(|e| format!("Failed to delete tag: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
