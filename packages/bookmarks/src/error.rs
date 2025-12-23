use thiserror::Error;

#[derive(Error, Debug)]
pub enum BookmarkError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Could not find data directory")]
    DataDirNotFound,

    #[error("Bookmark not found: {0}")]
    NotFound(i32),

    #[error("Failed to open URL: {0}")]
    OpenUrl(String),
}
