use serde::Serialize;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize)]
pub struct PlatformInfo {
    pub os: String,
    pub file_manager: String,
    pub chrome_executable: String,
    pub home_dir: Option<PathBuf>,
}

/// Returns platform-specific information for the current OS.
pub fn get_platform_info() -> PlatformInfo {
    #[cfg(target_os = "linux")]
    {
        PlatformInfo {
            os: "linux".to_string(),
            file_manager: "xdg-open".to_string(),
            chrome_executable: "google-chrome-stable".to_string(),
            home_dir: dirs::home_dir(),
        }
    }

    #[cfg(target_os = "windows")]
    {
        PlatformInfo {
            os: "windows".to_string(),
            file_manager: "explorer".to_string(),
            chrome_executable: "chrome".to_string(),
            home_dir: dirs::home_dir(),
        }
    }
}

/// Returns the Chrome configuration directory for the current OS.
pub fn get_chrome_config_dir() -> Option<PathBuf> {
    #[cfg(target_os = "linux")]
    {
        dirs::config_dir().map(|p| p.join("google-chrome"))
    }

    #[cfg(target_os = "windows")]
    {
        dirs::data_local_dir().map(|p| p.join("Google").join("Chrome").join("User Data"))
    }
}

/// Expands `~` and `~/` prefixes to the user's home directory.
pub fn expand_path(path: &str) -> String {
    if path == "~" {
        dirs::home_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| path.to_string())
    } else if let Some(rest) = path.strip_prefix("~/") {
        dirs::home_dir()
            .map(|p| p.join(rest).to_string_lossy().to_string())
            .unwrap_or_else(|| path.to_string())
    } else {
        path.to_string()
    }
}

/// Returns the list of allowed shell commands for the current OS.
pub fn get_allowed_commands() -> &'static [&'static str] {
    #[cfg(target_os = "linux")]
    {
        &["google-chrome-stable", "xdg-open", "code", "cursor"]
    }

    #[cfg(target_os = "windows")]
    {
        &["chrome", "explorer", "code", "cursor", "cmd"]
    }
}
