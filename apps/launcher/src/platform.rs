use serde::Serialize;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize)]
pub struct UserDirectory {
    pub id: String,
    pub name: String,
    pub path: String,
    pub icon: String,
}

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

/// Returns the list of standard user directories for the current OS.
pub fn get_user_directories() -> Vec<UserDirectory> {
    let mut directories = Vec::new();

    if let Some(path) = dirs::download_dir() {
        directories.push(UserDirectory {
            id: "downloads".to_string(),
            name: "Downloads".to_string(),
            path: path.to_string_lossy().to_string(),
            icon: "download".to_string(),
        });
    }

    if let Some(path) = dirs::document_dir() {
        directories.push(UserDirectory {
            id: "documents".to_string(),
            name: "Documents".to_string(),
            path: path.to_string_lossy().to_string(),
            icon: "file-text".to_string(),
        });
    }

    if let Some(path) = dirs::picture_dir() {
        directories.push(UserDirectory {
            id: "pictures".to_string(),
            name: "Pictures".to_string(),
            path: path.to_string_lossy().to_string(),
            icon: "image".to_string(),
        });
    }

    if let Some(path) = dirs::video_dir() {
        directories.push(UserDirectory {
            id: "videos".to_string(),
            name: "Videos".to_string(),
            path: path.to_string_lossy().to_string(),
            icon: "video".to_string(),
        });
    }

    if let Some(path) = dirs::audio_dir() {
        directories.push(UserDirectory {
            id: "music".to_string(),
            name: "Music".to_string(),
            path: path.to_string_lossy().to_string(),
            icon: "music".to_string(),
        });
    }

    if let Some(path) = dirs::desktop_dir() {
        directories.push(UserDirectory {
            id: "desktop".to_string(),
            name: "Desktop".to_string(),
            path: path.to_string_lossy().to_string(),
            icon: "monitor".to_string(),
        });
    }

    directories
}
