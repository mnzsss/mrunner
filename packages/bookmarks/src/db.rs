use crate::error::BookmarkError;
use crate::models::{Bookmark, BookmarkInput, Tag};
use rusqlite::{Connection, Row};
use std::collections::HashMap;
use std::path::PathBuf;

pub struct BookmarkStore {
    conn: Connection,
}

impl BookmarkStore {
    pub fn new() -> Result<Self, BookmarkError> {
        let db_path = Self::get_db_path()?;

        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(&db_path)?;
        let store = Self { conn };
        store.ensure_table()?;

        Ok(store)
    }

    pub fn with_path(path: PathBuf) -> Result<Self, BookmarkError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(&path)?;
        let store = Self { conn };
        store.ensure_table()?;

        Ok(store)
    }

    fn get_db_path() -> Result<PathBuf, BookmarkError> {
        #[cfg(target_os = "windows")]
        {
            dirs::data_dir()
                .map(|p| p.join("mrunner").join("bookmarks.db"))
                .ok_or(BookmarkError::DataDirNotFound)
        }

        #[cfg(not(target_os = "windows"))]
        {
            dirs::data_local_dir()
                .map(|p| p.join("mrunner").join("bookmarks.db"))
                .ok_or(BookmarkError::DataDirNotFound)
        }
    }

    fn ensure_table(&self) -> Result<(), BookmarkError> {
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS bookmarks (
                id INTEGER PRIMARY KEY,
                URL TEXT NOT NULL UNIQUE,
                metadata TEXT DEFAULT '',
                tags TEXT DEFAULT ',',
                desc TEXT DEFAULT '',
                flags INTEGER DEFAULT 0
            )",
            [],
        )?;
        Ok(())
    }

    fn row_to_bookmark(row: &Row) -> rusqlite::Result<Bookmark> {
        let tags_str: String = row.get(3)?;
        let tags: Vec<String> = tags_str
            .trim_matches(',')
            .split(',')
            .filter(|s| !s.is_empty())
            .map(|s| s.trim().to_string())
            .collect();

        Ok(Bookmark {
            id: row.get(0)?,
            url: row.get(1)?,
            title: row.get(2)?,
            tags,
            description: row.get(4)?,
        })
    }

    pub fn list(&self, limit: Option<u32>) -> Result<Vec<Bookmark>, BookmarkError> {
        let query = match limit {
            Some(n) => format!(
                "SELECT id, URL, metadata, tags, desc FROM bookmarks ORDER BY id DESC LIMIT {}",
                n
            ),
            None => {
                "SELECT id, URL, metadata, tags, desc FROM bookmarks ORDER BY id DESC".to_string()
            }
        };

        let mut stmt = self.conn.prepare(&query)?;
        let bookmarks = stmt
            .query_map([], Self::row_to_bookmark)?
            .filter_map(|r| r.ok())
            .collect();

        Ok(bookmarks)
    }

    pub fn search(
        &self,
        query: &str,
        tag_filter: Option<&[String]>,
        tag_or: bool,
    ) -> Result<Vec<Bookmark>, BookmarkError> {
        if query.is_empty() && tag_filter.is_none() {
            return self.list(None);
        }

        let mut conditions: Vec<String> = Vec::new();
        let mut params: Vec<String> = Vec::new();

        if !query.is_empty() {
            conditions.push(
                "(URL LIKE ?1 OR metadata LIKE ?1 OR tags LIKE ?1 OR desc LIKE ?1)".to_string(),
            );
            params.push(format!("%{}%", query));
        }

        if let Some(tags) = tag_filter {
            let tag_conditions: Vec<String> = tags
                .iter()
                .enumerate()
                .map(|(i, _)| format!("tags LIKE ?{}", params.len() + i + 2))
                .collect();

            let connector = if tag_or { " OR " } else { " AND " };
            conditions.push(format!("({})", tag_conditions.join(connector)));

            for tag in tags {
                params.push(format!("%,{},%", tag));
            }
        }

        let sql = format!(
            "SELECT id, URL, metadata, tags, desc FROM bookmarks WHERE {} ORDER BY id DESC",
            conditions.join(" AND ")
        );

        let mut stmt = self.conn.prepare(&sql)?;
        let param_refs: Vec<&dyn rusqlite::ToSql> =
            params.iter().map(|s| s as &dyn rusqlite::ToSql).collect();

        let bookmarks = stmt
            .query_map(param_refs.as_slice(), Self::row_to_bookmark)?
            .filter_map(|r| r.ok())
            .collect();

        Ok(bookmarks)
    }

    pub fn get(&self, id: i32) -> Result<Option<Bookmark>, BookmarkError> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, URL, metadata, tags, desc FROM bookmarks WHERE id = ?1")?;

        let bookmark = stmt.query_row([id], Self::row_to_bookmark).ok();
        Ok(bookmark)
    }

    pub fn open(&self, id: i32) -> Result<(), BookmarkError> {
        let bookmark = self.get(id)?.ok_or(BookmarkError::NotFound(id))?;
        open::that(&bookmark.url).map_err(|e| BookmarkError::OpenUrl(e.to_string()))?;
        Ok(())
    }

    pub fn add(&self, input: BookmarkInput) -> Result<i32, BookmarkError> {
        let tags_str = input
            .tags
            .map(|t| {
                if t.is_empty() {
                    ",".to_string()
                } else {
                    format!(",{},", t.join(","))
                }
            })
            .unwrap_or_else(|| ",".to_string());

        self.conn.execute(
            "INSERT INTO bookmarks (URL, metadata, tags, desc) VALUES (?1, ?2, ?3, ?4)",
            (
                &input.url,
                input.title.as_deref().unwrap_or(""),
                &tags_str,
                input.description.as_deref().unwrap_or(""),
            ),
        )?;

        Ok(self.conn.last_insert_rowid() as i32)
    }

    pub fn update(
        &self,
        id: i32,
        url: Option<&str>,
        title: Option<&str>,
        tags: Option<&[String]>,
        description: Option<&str>,
    ) -> Result<(), BookmarkError> {
        let mut updates: Vec<String> = Vec::new();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(u) = url {
            updates.push(format!("URL = ?{}", params.len() + 1));
            params.push(Box::new(u.to_string()));
        }

        if let Some(t) = title {
            updates.push(format!("metadata = ?{}", params.len() + 1));
            params.push(Box::new(t.to_string()));
        }

        if let Some(tg) = tags {
            let formatted = if tg.is_empty() {
                ",".to_string()
            } else {
                format!(",{},", tg.join(","))
            };
            updates.push(format!("tags = ?{}", params.len() + 1));
            params.push(Box::new(formatted));
        }

        if let Some(d) = description {
            updates.push(format!("desc = ?{}", params.len() + 1));
            params.push(Box::new(d.to_string()));
        }

        if updates.is_empty() {
            return Ok(());
        }

        params.push(Box::new(id));
        let sql = format!(
            "UPDATE bookmarks SET {} WHERE id = ?{}",
            updates.join(", "),
            params.len()
        );

        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|b| b.as_ref()).collect();
        self.conn.execute(&sql, param_refs.as_slice())?;

        Ok(())
    }

    pub fn delete(&self, id: i32) -> Result<(), BookmarkError> {
        self.conn
            .execute("DELETE FROM bookmarks WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn list_tags(&self) -> Result<Vec<Tag>, BookmarkError> {
        let mut stmt = self
            .conn
            .prepare("SELECT tags FROM bookmarks WHERE tags != ','")?;

        let mut tag_counts: HashMap<String, i32> = HashMap::new();

        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;

        for row in rows.flatten() {
            for tag in row.trim_matches(',').split(',') {
                let tag = tag.trim();
                if !tag.is_empty() {
                    *tag_counts.entry(tag.to_string()).or_insert(0) += 1;
                }
            }
        }

        let mut tags: Vec<Tag> = tag_counts
            .into_iter()
            .map(|(name, count)| Tag { name, count })
            .collect();

        tags.sort_by(|a, b| b.count.cmp(&a.count).then(a.name.cmp(&b.name)));

        Ok(tags)
    }

    pub fn rename_tag(&self, old_tag: &str, new_tag: &str) -> Result<(), BookmarkError> {
        let old_pattern = format!(",{},", old_tag);
        let new_pattern = format!(",{},", new_tag);

        self.conn.execute(
            "UPDATE bookmarks SET tags = REPLACE(tags, ?1, ?2) WHERE tags LIKE ?3",
            (&old_pattern, &new_pattern, format!("%{}%", old_pattern)),
        )?;

        Ok(())
    }

    pub fn delete_tag(&self, tag: &str) -> Result<(), BookmarkError> {
        let tag_pattern = format!(",{},", tag);

        self.conn.execute(
            "UPDATE bookmarks SET tags = REPLACE(tags, ?1, ',') WHERE tags LIKE ?2",
            (&tag_pattern, format!("%{}%", tag_pattern)),
        )?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn create_test_store() -> BookmarkStore {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        BookmarkStore::with_path(db_path).unwrap()
    }

    #[test]
    fn test_add_and_get_bookmark() {
        let store = create_test_store();

        let input = BookmarkInput::new("https://example.com")
            .with_title("Example")
            .with_tags(vec!["test".to_string(), "example".to_string()])
            .with_description("A test bookmark");

        let id = store.add(input).unwrap();
        let bookmark = store.get(id).unwrap().unwrap();

        assert_eq!(bookmark.url, "https://example.com");
        assert_eq!(bookmark.title, "Example");
        assert_eq!(bookmark.tags, vec!["test", "example"]);
        assert_eq!(bookmark.description, "A test bookmark");
    }

    #[test]
    fn test_list_bookmarks() {
        let store = create_test_store();

        store
            .add(BookmarkInput::new("https://example1.com"))
            .unwrap();
        store
            .add(BookmarkInput::new("https://example2.com"))
            .unwrap();

        let bookmarks = store.list(None).unwrap();
        assert_eq!(bookmarks.len(), 2);
    }

    #[test]
    fn test_delete_bookmark() {
        let store = create_test_store();

        let id = store
            .add(BookmarkInput::new("https://example.com"))
            .unwrap();
        store.delete(id).unwrap();

        let bookmark = store.get(id).unwrap();
        assert!(bookmark.is_none());
    }
}
