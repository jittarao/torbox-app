use std::path::{Path, PathBuf};

/// Normalize a filesystem path for stable comparison and persistence.
pub fn normalize_path(path: &str) -> Result<PathBuf, String> {
    let path = Path::new(path.trim());
    if !path.is_absolute() {
        return Err("Path must be absolute".into());
    }
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("Invalid path: {e}"))?;
    if !canonical.is_dir() {
        return Err("Path must be an existing directory".into());
    }
    Ok(canonical)
}

pub fn paths_equal(a: &str, b: &str) -> bool {
    normalize_path(a)
        .ok()
        .zip(normalize_path(b).ok())
        .map(|(left, right)| left == right)
        .unwrap_or(false)
}

/// Returns true when `file` is inside `parent` (or equal — files are not dirs so usually strict child).
pub fn is_path_inside(parent: &Path, file: &Path) -> bool {
    file.starts_with(parent)
}

pub fn is_hidden_file_name(name: &str) -> bool {
    name.starts_with('.')
}

pub fn is_torrent_file_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.ends_with(".torrent")
        && !lower.ends_with(".torrent.part")
        && !lower.ends_with(".torrent.tmp")
        && !lower.ends_with(".part")
        && !lower.ends_with(".tmp")
}

pub fn should_ignore_watched_file(
    file_path: &Path,
    watch_root: &Path,
    uploaded_subdir: Option<&Path>,
    custom_move_path: Option<&Path>,
) -> bool {
    let file_name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");

    if is_hidden_file_name(file_name) || !is_torrent_file_name(file_name) {
        return true;
    }

    if let Some(uploaded) = uploaded_subdir {
        if is_path_inside(uploaded, file_path) {
            return true;
        }
    }

    if let Some(custom) = custom_move_path {
        if is_path_inside(custom, file_path) && custom != watch_root {
            return true;
        }
    }

    // Ignore anything not directly under watch root (non-recursive safety).
    if let Some(parent) = file_path.parent() {
        if parent != watch_root {
            return true;
        }
    }

    false
}

pub fn uploaded_subdir(watch_root: &Path) -> PathBuf {
    watch_root.join("uploaded")
}

pub fn unique_destination_path(dest_dir: &Path, filename: &str) -> PathBuf {
    let mut candidate = dest_dir.join(filename);
    if !candidate.exists() {
        return candidate;
    }

    let path = Path::new(filename);
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("file");
    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("torrent");

    for index in 1..1000 {
        let name = format!("{stem} ({index}).{ext}");
        candidate = dest_dir.join(&name);
        if !candidate.exists() {
            return candidate;
        }
    }

    dest_dir.join(filename)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(prefix: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("{prefix}-{nanos}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn detects_torrent_extensions() {
        assert!(is_torrent_file_name("movie.torrent"));
        assert!(!is_torrent_file_name("movie.torrent.part"));
        assert!(!is_torrent_file_name("movie.part"));
        assert!(!is_torrent_file_name("readme.txt"));
    }

    #[test]
    fn ignores_files_in_uploaded_subdir() {
        let watch = temp_dir("tbm-watch");
        let uploaded = uploaded_subdir(&watch);
        fs::create_dir_all(&uploaded).unwrap();
        let file = uploaded.join("a.torrent");
        fs::write(&file, b"x").unwrap();

        assert!(should_ignore_watched_file(
            &file,
            &watch,
            Some(&uploaded),
            None
        ));
    }

    #[test]
    fn unique_destination_adds_suffix() {
        let dir = temp_dir("tbm-dest");
        let first = unique_destination_path(&dir, "a.torrent");
        fs::write(&first, b"1").unwrap();
        let second = unique_destination_path(&dir, "a.torrent");
        assert_eq!(second.file_name().unwrap().to_str().unwrap(), "a (1).torrent");
    }
}
