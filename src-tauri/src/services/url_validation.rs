use std::net::IpAddr;

use crate::constants::DEFAULT_INSTANCE_URL;
use url::Url;

fn is_private_or_local_host(host: &str) -> bool {
    let host = host.trim_end_matches('.').to_ascii_lowercase();
    if host == "localhost" || host.ends_with(".local") {
        return true;
    }

    host.parse::<IpAddr>()
        .map(|ip| match ip {
            IpAddr::V4(v4) => v4.is_private() || v4.is_loopback(),
            IpAddr::V6(v6) => v6.is_loopback(),
        })
        .unwrap_or(false)
}

/// Validates and normalizes a custom instance URL (origin only).
/// Public hosts must use HTTPS; local/private network hosts may use HTTP.
pub fn validate_instance_url(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("Instance URL cannot be empty".into());
    }

    let parsed = Url::parse(trimmed).map_err(|_| "Invalid URL".to_string())?;

    let host = parsed
        .host_str()
        .ok_or_else(|| "Instance URL must include a host".to_string())?;

    if host.is_empty() {
        return Err("Instance URL must include a host".into());
    }

    let allows_http = is_private_or_local_host(host);
    match parsed.scheme() {
        "https" => {}
        "http" if allows_http => {}
        "http" => {
            return Err(
                "Instance URL must use https:// for public hosts (http:// is only allowed on local/private networks)".into(),
            );
        }
        _ => {
            return Err("Instance URL must use https:// or http:// on local/private networks".into());
        }
    }

    if parsed.username() != "" || parsed.password().is_some() {
        return Err("Instance URL must not include credentials".into());
    }

    let path = parsed.path();
    if path != "/" && !path.is_empty() {
        return Err("Instance URL must not include a path".into());
    }

    if parsed.query().is_some() || parsed.fragment().is_some() {
        return Err("Instance URL must not include query or fragment".into());
    }

    let port = parsed.port();
    let default_port = if parsed.scheme() == "https" { 443 } else { 80 };
    let origin = match port {
        Some(p) if p != default_port => format!("{}://{}:{}", parsed.scheme(), host, p),
        _ => format!("{}://{}", parsed.scheme(), host),
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
    fn rejects_http_for_public_hosts() {
        assert!(validate_instance_url("http://tbm.tools").is_err());
    }

    #[test]
    fn accepts_localhost_http() {
        assert_eq!(
            validate_instance_url("http://localhost:3000").unwrap(),
            "http://localhost:3000"
        );
    }

    #[test]
    fn accepts_private_lan_http() {
        assert_eq!(
            validate_instance_url("http://192.168.1.42:3000").unwrap(),
            "http://192.168.1.42:3000"
        );
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
