use url::Url;

const MAX_WEB_PATH_LEN: usize = 2048;

pub fn validate_web_path(path: &str) -> Result<&str, String> {
    let path = path.trim();
    if path.is_empty() {
        return Err("Path is empty".into());
    }
    if !path.starts_with('/') {
        return Err("Path must start with /".into());
    }
    if path.starts_with("//") {
        return Err("Invalid path".into());
    }
    if path.contains("://") {
        return Err("Invalid path".into());
    }
    if path.len() > MAX_WEB_PATH_LEN {
        return Err("Path too long".into());
    }
    Ok(path)
}

pub fn is_meaningful_web_path(path: &str) -> bool {
    validate_web_path(path).is_ok() && path != "/"
}

pub fn navigation_url_for_path(base: &str, web_path: &str) -> Result<Url, String> {
    let web_path = validate_web_path(web_path)?;
    let target = format!("{}{}", base.trim_end_matches('/'), web_path);
    Url::parse(&target).map_err(|e| format!("Invalid navigation URL: {e}"))
}

pub fn extract_web_path_from_url(current: &Url) -> Option<String> {
    let mut path = current.path().to_string();
    if let Some(query) = current.query() {
        path.push('?');
        path.push_str(query);
    }
    if is_meaningful_web_path(&path) {
        Some(path)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_rejects_protocol_relative_paths() {
        assert!(validate_web_path("//evil.example").is_err());
        assert!(validate_web_path("https://evil.example").is_err());
    }

    #[test]
    fn navigation_url_combines_base_and_path() {
        let url = navigation_url_for_path("https://tbm.tools", "/en/uploads").unwrap();
        assert_eq!(url.as_str(), "https://tbm.tools/en/uploads");
    }

    #[test]
    fn extract_web_path_includes_query() {
        let current = Url::parse("https://tbm.tools/en/uploads?tab=queued").unwrap();
        assert_eq!(
            extract_web_path_from_url(&current),
            Some("/en/uploads?tab=queued".to_string())
        );
    }

    #[test]
    fn extract_web_path_ignores_root() {
        let current = Url::parse("https://tbm.tools/").unwrap();
        assert_eq!(extract_web_path_from_url(&current), None);
    }
}
