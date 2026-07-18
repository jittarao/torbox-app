use std::collections::HashMap;
use std::time::Duration;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE};
use reqwest::Response;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::constants::{
    MAX_BATCH_UPLOADS_PER_REQUEST, MAX_TORRENT_FILE_BYTES, UPLOAD_RATE_LIMIT_DEFAULT_RETRY_SECS,
};
use crate::services::settings::TorrentUploadOptions;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
struct BatchUploadItem {
    #[serde(rename = "type")]
    asset_type: String,
    upload_type: String,
    name: String,
    file_data: String,
    filename: String,
    seed: u8,
    allow_zip: bool,
    as_queued: bool,
    add_only_if_cached: bool,
}

#[derive(Debug, Clone, Serialize)]
struct BatchRequest {
    uploads: Vec<BatchUploadItem>,
}

#[derive(Debug, Deserialize)]
struct BatchResponse {
    success: bool,
    #[serde(default)]
    error: Option<String>,
    #[serde(default)]
    detail: Option<String>,
    #[serde(default)]
    data: Option<BatchData>,
}

#[derive(Debug, Deserialize)]
struct BatchData {
    #[serde(default)]
    uploads: Vec<BatchUploadRow>,
    #[serde(default)]
    errors: Vec<BatchItemError>,
}

#[derive(Debug, Deserialize)]
struct BatchUploadRow {
    #[serde(default)]
    id: Option<i64>,
    #[serde(default)]
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct BatchErrorUpload {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    filename: Option<String>,
}

#[derive(Debug, Deserialize)]
struct BatchItemError {
    #[serde(default)]
    error: Option<String>,
    #[serde(default)]
    upload: Option<BatchErrorUpload>,
}

#[derive(Debug, Clone)]
pub struct TorrentFileUpload {
    pub file_bytes: Vec<u8>,
    pub filename: String,
    pub options: TorrentUploadOptions,
}

#[derive(Debug, Clone)]
pub struct UploadSuccess {
    pub upload_id: Option<String>,
}

#[derive(Debug, Clone)]
pub struct BatchItemResult {
    pub success: Option<UploadSuccess>,
    pub error: Option<String>,
}

#[derive(Debug, Clone)]
pub struct UploadClientError {
    pub message: String,
    pub rate_limited: bool,
    pub retry_after_secs: Option<u64>,
}

impl UploadClientError {
    pub fn retry_delay(&self) -> Duration {
        Duration::from_secs(
            self.retry_after_secs
                .unwrap_or(UPLOAD_RATE_LIMIT_DEFAULT_RETRY_SECS)
                .max(1),
        )
    }
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    format!("{:x}", digest)
}

pub fn torrent_display_name(filename: &str) -> String {
    filename
        .strip_suffix(".torrent")
        .or_else(|| filename.strip_suffix(".TORRENT"))
        .unwrap_or(filename)
        .to_string()
}

#[allow(dead_code)]
pub async fn upload_torrent_file(
    instance_url: &str,
    api_key: &str,
    file_bytes: &[u8],
    filename: &str,
    options: &TorrentUploadOptions,
) -> Result<UploadSuccess, UploadClientError> {
    let results = upload_torrent_batch_detailed(
        instance_url,
        api_key,
        vec![TorrentFileUpload {
            file_bytes: file_bytes.to_vec(),
            filename: filename.to_string(),
            options: options.clone(),
        }],
    )
    .await?;

    let first = results
        .into_iter()
        .next()
        .ok_or_else(|| UploadClientError {
            message: "Upload was not created".to_string(),
            rate_limited: false,
            retry_after_secs: None,
        })?;

    if let Some(success) = first.success {
        Ok(success)
    } else {
        let error_message = first
            .error
            .clone()
            .unwrap_or_else(|| "Upload was not created".to_string());
        Err(UploadClientError {
            message: error_message.clone(),
            rate_limited: is_rate_limit_message(&error_message),
            retry_after_secs: None,
        })
    }
}

#[allow(dead_code)]
pub async fn upload_torrent_batch(
    instance_url: &str,
    api_key: &str,
    items: Vec<TorrentFileUpload>,
) -> Result<Vec<UploadSuccess>, UploadClientError> {
    let detailed = upload_torrent_batch_detailed(instance_url, api_key, items).await?;
    let successes: Vec<_> = detailed
        .iter()
        .filter_map(|row| row.success.clone())
        .collect();

    if successes.is_empty() && !detailed.is_empty() {
        let message = detailed
            .iter()
            .find_map(|row| row.error.clone())
            .unwrap_or_else(|| "Upload was not created".to_string());
        return Err(UploadClientError {
            message: message.clone(),
            rate_limited: is_rate_limit_message(&message),
            retry_after_secs: None,
        });
    }

    Ok(successes)
}

pub async fn upload_torrent_batch_detailed(
    instance_url: &str,
    api_key: &str,
    items: Vec<TorrentFileUpload>,
) -> Result<Vec<BatchItemResult>, UploadClientError> {
    if items.is_empty() {
        return Err(UploadClientError {
            message: "No torrent files to upload".to_string(),
            rate_limited: false,
            retry_after_secs: None,
        });
    }

    for item in &items {
        if item.file_bytes.len() as u64 > MAX_TORRENT_FILE_BYTES {
            return Err(UploadClientError {
                message: format!(
                    "Torrent file exceeds maximum size of {} bytes",
                    MAX_TORRENT_FILE_BYTES
                ),
                rate_limited: false,
                retry_after_secs: None,
            });
        }
    }

    let mut created = Vec::with_capacity(items.len());

    for chunk in items.chunks(MAX_BATCH_UPLOADS_PER_REQUEST) {
        let chunk_results = post_batch_upload_detailed(instance_url, api_key, chunk).await?;
        created.extend(chunk_results);
    }

    Ok(created)
}

async fn post_batch_upload_detailed(
    instance_url: &str,
    api_key: &str,
    items: &[TorrentFileUpload],
) -> Result<Vec<BatchItemResult>, UploadClientError> {
    if items.is_empty() {
        return Ok(vec![]);
    }

    if items.len() > MAX_BATCH_UPLOADS_PER_REQUEST {
        return Err(UploadClientError {
            message: format!(
                "Internal batch size {} exceeds maximum of {}",
                items.len(),
                MAX_BATCH_UPLOADS_PER_REQUEST
            ),
            rate_limited: false,
            retry_after_secs: None,
        });
    }

    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err(UploadClientError {
            message: "No API key stored on this device".to_string(),
            rate_limited: false,
            retry_after_secs: None,
        });
    }

    let base_url = instance_url.trim_end_matches('/');
    let endpoint = format!("{base_url}/api/uploads/batch");

    let uploads = items
        .iter()
        .map(|item| BatchUploadItem {
            asset_type: "torrent".to_string(),
            upload_type: "file".to_string(),
            name: torrent_display_name(&item.filename),
            file_data: STANDARD.encode(&item.file_bytes),
            filename: item.filename.clone(),
            seed: item.options.seed,
            allow_zip: item.options.allow_zip,
            as_queued: item.options.as_queued,
            add_only_if_cached: item.options.add_only_if_cached,
        })
        .collect();

    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert(
        "x-api-key",
        HeaderValue::from_str(&api_key).map_err(|_| UploadClientError {
            message: "Invalid API key".to_string(),
            rate_limited: false,
            retry_after_secs: None,
        })?,
    );

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| UploadClientError {
            message: format!("HTTP client error: {e}"),
            rate_limited: false,
            retry_after_secs: None,
        })?;

    let response = client
        .post(&endpoint)
        .headers(headers)
        .json(&BatchRequest { uploads })
        .send()
        .await
        .map_err(|e| UploadClientError {
            message: format!("Upload request failed: {e}"),
            rate_limited: false,
            retry_after_secs: None,
        })?;

    parse_batch_response_detailed(response, items).await
}

async fn parse_batch_response_detailed(
    response: Response,
    items: &[TorrentFileUpload],
) -> Result<Vec<BatchItemResult>, UploadClientError> {
    let status = response.status();
    let retry_after_secs = parse_retry_after(&response);
    let rate_limited = status.as_u16() == 429;

    let payload: BatchResponse = response.json().await.map_err(|e| UploadClientError {
        message: format!("Invalid upload response: {e}"),
        rate_limited,
        retry_after_secs,
    })?;

    if rate_limited {
        let message = format_batch_error(&payload, status);
        return Err(UploadClientError {
            message,
            rate_limited: true,
            retry_after_secs,
        });
    }

    if !status.is_success() || !payload.success {
        let message = format_batch_error(&payload, status);
        let rate_limited = is_rate_limit_message(&message);
        return Err(UploadClientError {
            message,
            rate_limited,
            retry_after_secs,
        });
    }

    let data = payload.data.ok_or_else(|| UploadClientError {
        message: "Upload response missing data".to_string(),
        rate_limited: false,
        retry_after_secs: None,
    })?;

    if data.uploads.is_empty() && data.errors.is_empty() {
        let message = payload
            .error
            .unwrap_or_else(|| "Upload was not created".to_string());

        return Err(UploadClientError {
            message: message.clone(),
            rate_limited: is_rate_limit_message(&message),
            retry_after_secs,
        });
    }

    Ok(map_batch_results(items, &data))
}

fn map_batch_results(items: &[TorrentFileUpload], data: &BatchData) -> Vec<BatchItemResult> {
    let mut successes_by_name: HashMap<String, UploadSuccess> = HashMap::new();
    for row in &data.uploads {
        if let Some(name) = row.name.as_ref() {
            successes_by_name.insert(
                name.clone(),
                UploadSuccess {
                    upload_id: row.id.map(|id| id.to_string()),
                },
            );
        }
    }

    let mut errors_by_name: HashMap<String, String> = HashMap::new();
    let mut errors_by_filename: HashMap<String, String> = HashMap::new();
    for item_error in &data.errors {
        let message = item_error
            .error
            .clone()
            .unwrap_or_else(|| "Upload failed".to_string());
        if let Some(upload) = &item_error.upload {
            if let Some(name) = &upload.name {
                errors_by_name.insert(name.clone(), message.clone());
            }
            if let Some(filename) = &upload.filename {
                errors_by_filename.insert(filename.clone(), message);
            }
        }
    }

    items
        .iter()
        .map(|item| {
            let display_name = torrent_display_name(&item.filename);
            if let Some(error) = errors_by_filename
                .get(&item.filename)
                .or_else(|| errors_by_name.get(&display_name))
                .cloned()
            {
                return BatchItemResult {
                    success: None,
                    error: Some(error),
                };
            }

            if let Some(success) = successes_by_name.remove(&display_name) {
                return BatchItemResult {
                    success: Some(success),
                    error: None,
                };
            }

            BatchItemResult {
                success: None,
                error: Some("Upload was not created".to_string()),
            }
        })
        .collect()
}

fn format_batch_error(payload: &BatchResponse, status: reqwest::StatusCode) -> String {
    payload
        .error
        .clone()
        .or_else(|| payload.detail.clone())
        .or_else(|| {
            payload
                .data
                .as_ref()
                .and_then(|d| d.errors.first())
                .and_then(|e| e.error.clone())
        })
        .unwrap_or_else(|| format!("Upload failed with status {status}"))
}

fn parse_retry_after(response: &Response) -> Option<u64> {
    parse_retry_after_values(
        response
            .headers()
            .get("retry-after")
            .and_then(|value| value.to_str().ok()),
        response
            .headers()
            .get("ratelimit-reset")
            .and_then(|value| value.to_str().ok()),
    )
}

fn parse_retry_after_values(
    retry_after: Option<&str>,
    rate_limit_reset: Option<&str>,
) -> Option<u64> {
    if let Some(raw) = retry_after {
        if let Ok(secs) = raw.parse::<u64>() {
            return Some(secs.max(1));
        }
    }

    if let Some(raw) = rate_limit_reset {
        if let Ok(secs) = raw.parse::<u64>() {
            return Some(secs.max(1));
        }
    }

    None
}

fn is_rate_limit_message(message: &str) -> bool {
    let lower = message.to_lowercase();
    lower.contains("rate limit")
        || lower.contains("too many upload requests")
        || lower.contains("too many requests")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn batch_request_uses_snake_case_api_fields() {
        let body = BatchRequest {
            uploads: vec![BatchUploadItem {
                asset_type: "torrent".to_string(),
                upload_type: "file".to_string(),
                name: "example".to_string(),
                file_data: "ZGF0YQ==".to_string(),
                filename: "example.torrent".to_string(),
                seed: 1,
                allow_zip: true,
                as_queued: false,
                add_only_if_cached: false,
            }],
        };

        let json = serde_json::to_value(body).expect("serialize batch request");
        let upload = &json["uploads"][0];

        assert_eq!(upload["type"], "torrent");
        assert_eq!(upload["upload_type"], "file");
        assert_eq!(upload["file_data"], "ZGF0YQ==");
        assert_eq!(upload["allow_zip"], true);
        assert!(upload.get("uploadType").is_none());
        assert!(upload.get("fileData").is_none());
        assert!(upload.get("allowZip").is_none());
    }

    #[test]
    fn detects_rate_limit_messages() {
        assert!(is_rate_limit_message(
            "Upload rate limit exceeded. Please wait before making more requests."
        ));
        assert!(is_rate_limit_message("Too many upload requests, please try again later."));
        assert!(!is_rate_limit_message("Invalid upload_type. Must be file, magnet, or link"));
    }

    #[test]
    fn upload_client_error_uses_default_retry_delay() {
        let error = UploadClientError {
            message: "rate limited".to_string(),
            rate_limited: true,
            retry_after_secs: None,
        };
        assert_eq!(
            error.retry_delay(),
            Duration::from_secs(UPLOAD_RATE_LIMIT_DEFAULT_RETRY_SECS)
        );
    }

    #[test]
    fn batch_chunks_at_max_request_size() {
        let chunks: Vec<_> = (0..2500)
            .collect::<Vec<_>>()
            .chunks(MAX_BATCH_UPLOADS_PER_REQUEST)
            .map(|chunk| chunk.len())
            .collect();
        assert_eq!(chunks, vec![1000, 1000, 500]);
    }

    #[test]
    fn parse_retry_after_prefers_retry_after_header() {
        assert_eq!(
            parse_retry_after_values(Some("42"), Some("120")),
            Some(42)
        );
    }

    #[test]
    fn parse_retry_after_falls_back_to_ratelimit_reset() {
        assert_eq!(parse_retry_after_values(None, Some("90")), Some(90));
    }

    #[test]
    fn parse_retry_after_ignores_invalid_values() {
        assert_eq!(parse_retry_after_values(Some("soon"), Some("nope")), None);
    }

    #[test]
    fn batch_limits_match_server_contract() {
        use crate::constants::{UPLOAD_HTTP_RATE_LIMIT_MAX, UPLOAD_HTTP_RATE_LIMIT_WINDOW_SECS};

        assert_eq!(MAX_BATCH_UPLOADS_PER_REQUEST, 1000);
        assert_eq!(UPLOAD_HTTP_RATE_LIMIT_MAX, 1000);
        assert_eq!(UPLOAD_HTTP_RATE_LIMIT_WINDOW_SECS, 15 * 60);
    }

    #[test]
    fn map_batch_results_handles_mixed_success_and_error() {
        let items = vec![
            TorrentFileUpload {
                file_bytes: b"a".to_vec(),
                filename: "good.torrent".to_string(),
                options: TorrentUploadOptions::default(),
            },
            TorrentFileUpload {
                file_bytes: b"b".to_vec(),
                filename: "bad.torrent".to_string(),
                options: TorrentUploadOptions::default(),
            },
        ];

        let data = BatchData {
            uploads: vec![BatchUploadRow {
                id: Some(42),
                name: Some("good".to_string()),
            }],
            errors: vec![BatchItemError {
                error: Some("Invalid type".to_string()),
                upload: Some(BatchErrorUpload {
                    name: Some("bad".to_string()),
                    filename: None,
                }),
            }],
        };

        let results = map_batch_results(&items, &data);
        assert_eq!(results.len(), 2);
        assert!(results[0].success.is_some());
        assert_eq!(results[0].success.as_ref().unwrap().upload_id, Some("42".to_string()));
        assert!(results[0].error.is_none());
        assert!(results[1].success.is_none());
        assert_eq!(results[1].error.as_deref(), Some("Invalid type"));
    }

    #[test]
    fn map_batch_results_matches_errors_by_filename() {
        let items = vec![TorrentFileUpload {
            file_bytes: b"x".to_vec(),
            filename: "broken.torrent".to_string(),
            options: TorrentUploadOptions::default(),
        }];

        let data = BatchData {
            uploads: vec![],
            errors: vec![BatchItemError {
                error: Some("Failed to save file".to_string()),
                upload: Some(BatchErrorUpload {
                    name: None,
                    filename: Some("broken.torrent".to_string()),
                }),
            }],
        };

        let results = map_batch_results(&items, &data);
        assert_eq!(results[0].error.as_deref(), Some("Failed to save file"));
    }

    #[test]
    fn torrent_display_name_strips_suffix() {
        assert_eq!(torrent_display_name("foo.torrent"), "foo");
        assert_eq!(torrent_display_name("FOO.TORRENT"), "FOO");
    }
}
