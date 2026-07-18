use std::fs;
use std::path::Path;

pub fn write_atomic(path: &Path, contents: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Invalid path: missing parent directory".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|e| format!("Failed to create directory for {path:?}: {e}"))?;

    let temp_path = path.with_extension("tmp");
    fs::write(&temp_path, contents)
        .map_err(|e| format!("Failed to write temp file {temp_path:?}: {e}"))?;
    fs::rename(&temp_path, path).map_err(|e| format!("Failed to rename temp file: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_file(name: &str) -> std::path::PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("{name}-{nanos}.json"))
    }

    #[test]
    fn write_atomic_creates_file() {
        let path = temp_file("atomic-json");
        write_atomic(&path, r#"{"ok":true}"#).unwrap();
        let raw = fs::read_to_string(&path).unwrap();
        assert_eq!(raw, r#"{"ok":true}"#);
        let _ = fs::remove_file(path);
    }
}
