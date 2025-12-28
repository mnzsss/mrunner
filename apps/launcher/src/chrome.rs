use crate::platform;
use serde::Serialize;
use std::fs;

#[derive(Debug, Serialize)]
pub struct ChromeProfile {
    pub directory: String,
    pub name: String,
}

#[tauri::command]
pub fn list_chrome_profiles() -> Result<Vec<ChromeProfile>, String> {
    let chrome_dir =
        platform::get_chrome_config_dir().ok_or("Could not determine Chrome config directory")?;

    if !chrome_dir.exists() {
        return Ok(Vec::new());
    }

    // Read profile names from Local State file
    let local_state_path = chrome_dir.join("Local State");
    let content = fs::read_to_string(&local_state_path).map_err(|e| e.to_string())?;
    let json: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    let info_cache = json
        .get("profile")
        .and_then(|p| p.get("info_cache"))
        .and_then(|c| c.as_object())
        .ok_or("Could not read profile info cache")?;

    let mut profiles: Vec<ChromeProfile> = info_cache
        .iter()
        .filter(|(dir, _)| *dir != "System Profile")
        .filter_map(|(dir, info)| {
            let name = info.get("name").and_then(|n| n.as_str())?;
            Some(ChromeProfile {
                directory: dir.clone(),
                name: name.to_string(),
            })
        })
        .collect();

    profiles.sort_by(|a, b| a.directory.cmp(&b.directory));

    Ok(profiles)
}
