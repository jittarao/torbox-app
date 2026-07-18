use crate::constants::DEFAULT_INSTANCE_URL;
use url::Url;

/// Validates and normalizes a custom instance URL (origin only, https required).
pub fn validate_instance_url(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("Instance URL cannot be empty".into());
    }

    let parsed = Url::parse(trimmed).map_err(|_| "Invalid URL".to_string())?;

    if parsed.scheme() != "https" {
        return Err("Instance URL must use https://".into());
    }

    if parsed.username() != "" || parsed.password().is_some() {
        return Err("Instance URL must not include credentials".into());
    }

    let host = parsed
        .host_str()
        .ok_or_else(|| "Instance URL must include a host".to_string())?;

    if host.is_empty() {
        return Err("Instance URL must include a host".into());
    }

    let path = parsed.path();
    if path != "/" && !path.is_empty() {
        return Err("Instance URL must not include a path".into());
    }

    if parsed.query().is_some() || parsed.fragment().is_some() {
        return Err("Instance URL must not include query or fragment".into());
    }

    let port = parsed.port();
    let origin = match port {
        Some(p) if p != 443 => format!("https://{}:{}", host, p),
        _ => format!("https://{}", host),
    };

    Ok(origin)
}

pub fn default_instance_url() -> String {
    DEFAULT_INSTANCE_URL.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_https_origin() {
        assert_eq!(
            validate_instance_url("https://tbm.tools").unwrap(),
            "https://tbm.tools"
        );
    }

    #[test]
    fn accepts_https_with_trailing_slash() {
        assert_eq!(
            validate_instance_url("https://tbm.tools/").unwrap(),
            "https://tbm.tools"
        );
    }

    #[test]
    fn accepts_custom_port() {
        assert_eq!(
            validate_instance_url("https://example.com:8443").unwrap(),
            "https://example.com:8443"
        );
    }

    #[test]
    fn rejects_http() {
        assert!(validate_instance_url("http://tbm.tools").is_err());
    }

    #[test]
    fn rejects_localhost_http_dev_url() {
        assert!(validate_instance_url("http://localhost:3000").is_err());
    }

    #[test]
    fn rejects_userinfo() {
        assert!(validate_instance_url("https://user:pass@tbm.tools").is_err());
    }

    #[test]
    fn rejects_path() {
        assert!(validate_instance_url("https://tbm.tools/app").is_err());
    }

    #[test]
    fn rejects_query() {
        assert!(validate_instance_url("https://tbm.tools?x=1").is_err());
    }

    #[test]
    fn rejects_empty() {
        assert!(validate_instance_url("").is_err());
    }
}
