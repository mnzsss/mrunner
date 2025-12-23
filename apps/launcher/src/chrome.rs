use crate::platform;
use serde::Serialize;
use std::fs;

#[derive(Debug, Serialize)]
pub struct ChromeProfile {
    pub directory: String,
    pub name: String,
}

fn extract_profile_name(json: &serde_json::Value) -> Option<String> {
    // Try to get name from account_info (Google account name)
    if let Some(account_info) = json.get("account_info").and_then(|a| a.as_array()) {
        if let Some(first_account) = account_info.first() {
            // Try email domain first for unique identification
            if let Some(email) = first_account.get("email").and_then(|e| e.as_str()) {
                let domain = email.split('@').nth(1).unwrap_or("");
                let name = match domain {
                    d if d.contains("beyoung") => "Beyoung",
                    d if d.contains("gaio") => "Gaio",
                    _ => {
                        // Fall back to given_name or full_name
                        if let Some(name) = first_account.get("given_name").and_then(|n| n.as_str()) {
                            if !name.is_empty() {
                                return Some(name.to_string());
                            }
                        }
                        if let Some(name) = first_account.get("full_name").and_then(|n| n.as_str()) {
                            if !name.is_empty() {
                                return Some(name.to_string());
                            }
                        }
                        "Personal"
                    }
                };
                return Some(name.to_string());
            }
        }
    }

    // Fall back to profile.name
    json.get("profile")
        .and_then(|p| p.get("name"))
        .and_then(|n| n.as_str())
        .map(|s| s.to_string())
}

#[tauri::command]
pub fn list_chrome_profiles() -> Result<Vec<ChromeProfile>, String> {
    let chrome_dir =
        platform::get_chrome_config_dir().ok_or("Could not determine Chrome config directory")?;

    if !chrome_dir.exists() {
        return Ok(Vec::new());
    }

    let mut profiles = Vec::new();
    let mut seen_names: std::collections::HashSet<String> = std::collections::HashSet::new();

    let entries = fs::read_dir(&chrome_dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let preferences_path = path.join("Preferences");
        if !preferences_path.exists() {
            continue;
        }

        let dir_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        // Skip system profile
        if dir_name == "System Profile" {
            continue;
        }

        // Read and parse Preferences JSON
        if let Ok(content) = fs::read_to_string(&preferences_path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(name) = extract_profile_name(&json) {
                    // Skip duplicate names
                    if seen_names.contains(&name) {
                        continue;
                    }
                    seen_names.insert(name.clone());

                    profiles.push(ChromeProfile {
                        directory: dir_name,
                        name,
                    });
                }
            }
        }
    }

    // Sort by directory name for consistent ordering
    profiles.sort_by(|a, b| a.directory.cmp(&b.directory));

    Ok(profiles)
}
