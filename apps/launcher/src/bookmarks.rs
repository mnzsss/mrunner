use bookmarks::{Bookmark, BookmarkError, BookmarkStore, Tag};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookmarkResponse {
    pub index: i32,
    pub uri: String,
    pub title: String,
    pub tags: String,
    pub description: String,
}

impl From<Bookmark> for BookmarkResponse {
    fn from(b: Bookmark) -> Self {
        Self {
            index: b.id,
            uri: b.url,
            title: b.title,
            tags: b.tags.join(", "),
            description: b.description,
        }
    }
}

fn map_error(e: BookmarkError) -> String {
    e.to_string()
}

#[tauri::command]
pub fn bookmark_list(limit: Option<i32>) -> Result<Vec<BookmarkResponse>, String> {
    let store = BookmarkStore::new().map_err(map_error)?;
    let bookmarks = store.list(limit.map(|n| n as u32)).map_err(map_error)?;
    Ok(bookmarks.into_iter().map(BookmarkResponse::from).collect())
}

#[tauri::command]
pub fn bookmark_search(
    query: String,
    #[allow(non_snake_case)] tagFilter: Option<String>,
    #[allow(non_snake_case)] tagOr: Option<bool>,
) -> Result<Vec<BookmarkResponse>, String> {
    let store = BookmarkStore::new().map_err(map_error)?;

    let tags: Option<Vec<String>> = tagFilter.map(|t| {
        t.split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    });

    let bookmarks = store
        .search(&query, tags.as_deref(), tagOr.unwrap_or(false))
        .map_err(map_error)?;

    Ok(bookmarks.into_iter().map(BookmarkResponse::from).collect())
}

#[tauri::command]
pub fn bookmark_get_by_id(id: i32) -> Result<Option<BookmarkResponse>, String> {
    let store = BookmarkStore::new().map_err(map_error)?;
    let bookmark = store.get(id).map_err(map_error)?;
    Ok(bookmark.map(BookmarkResponse::from))
}

#[tauri::command]
pub fn bookmark_open(id: i32) -> Result<(), String> {
    let store = BookmarkStore::new().map_err(map_error)?;
    store.open(id).map_err(map_error)
}

#[tauri::command]
pub fn bookmark_add(
    url: String,
    title: Option<String>,
    tags: Option<String>,
    description: Option<String>,
) -> Result<(), String> {
    let store = BookmarkStore::new().map_err(map_error)?;

    let tags_vec: Option<Vec<String>> = tags.map(|t| {
        t.split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    });

    let input = bookmarks::BookmarkInput {
        url,
        title,
        tags: tags_vec,
        description,
    };

    store.add(input).map_err(map_error)?;
    Ok(())
}

#[tauri::command]
pub fn bookmark_update(
    id: i32,
    url: Option<String>,
    title: Option<String>,
    tags: Option<String>,
    description: Option<String>,
) -> Result<(), String> {
    let store = BookmarkStore::new().map_err(map_error)?;

    let tags_vec: Option<Vec<String>> = tags.map(|t| {
        t.split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    });

    store
        .update(
            id,
            url.as_deref(),
            title.as_deref(),
            tags_vec.as_deref(),
            description.as_deref(),
        )
        .map_err(map_error)
}

#[tauri::command]
pub fn bookmark_delete(id: i32) -> Result<(), String> {
    let store = BookmarkStore::new().map_err(map_error)?;
    store.delete(id).map_err(map_error)
}

#[tauri::command]
pub fn bookmark_list_tags() -> Result<Vec<Tag>, String> {
    let store = BookmarkStore::new().map_err(map_error)?;
    store.list_tags().map_err(map_error)
}

#[tauri::command]
pub fn bookmark_rename_tag(old_tag: String, new_tag: String) -> Result<(), String> {
    let store = BookmarkStore::new().map_err(map_error)?;
    store.rename_tag(&old_tag, &new_tag).map_err(map_error)
}

#[tauri::command]
pub fn bookmark_delete_tag(tag: String) -> Result<(), String> {
    let store = BookmarkStore::new().map_err(map_error)?;
    store.delete_tag(&tag).map_err(map_error)
}
