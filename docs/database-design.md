# Backend Database Design

This document describes the current TorBox Manager backend persistence model. It is
intended as a reference for future schema, migration, and provisioning work.

## Overview

The backend uses SQLite in a two-level layout:

- The master database stores global user registry data, encrypted API keys,
  scheduler metadata, persisted pending automation actions, upload counters, and
  activity/quota metadata.
- Each user can have one per-user SQLite database for feature data that belongs
  only to that user.

The storage architecture intentionally isolates user-owned feature data from the
master database. The master database is the source of truth for whether a user is
registered and active. A user database is the source of truth for automation
rules, custom views, tags, archived downloads, uploads, link history, protection
flags, and per-user automation state.

## Files And Runtime Owners

- Master database path: `MASTER_DB_PATH`, defaulting to `data/master.db`.
- User database directory: `USER_DB_DIR`, defaulting to `data/users`.
- User database path: `user_<authId>.sqlite` under `USER_DB_DIR`.
- Master database owner: `backend/src/database/Database.js`.
- User database owner: `backend/src/database/UserDatabaseManager.js`.
- Migrations: `backend/src/database/migrations/master` and
  `backend/src/database/migrations/user`.

Both master and user databases use the shared migration runner. User migrations
run when a user database is opened/provisioned. This means new user databases
are created at the latest schema version, and existing user databases are
upgraded lazily when they are next opened.

## Master Database

The master database is global. It must always exist before backend services
start.

### `schema_migrations`

Tracks applied master migrations.

Important columns:

- `version`
- `name`
- `applied_at`

### `user_registry`

One row per registered user. `auth_id` is the SHA-256 hash of the TorBox API key.

Important columns:

- `auth_id`: primary key.
- `db_path`: intended path for that user's SQLite database.
- `status`: user lifecycle state, normally `active` or `inactive`.
- `has_active_rules`: scheduler optimization flag.
- `non_terminal_torrent_count`: scheduler/adaptive polling metadata.
- `next_poll_at`: next automation poll eligibility timestamp.
- `queued_uploads_count`: denormalized upload queue count.
- `next_upload_attempt_at`: next queued upload processing timestamp.
- `consecutive_auth_failures`: persistent auth failure counter.
- `consecutive_plan_restricted_failures`: persistent plan restriction counter.
- `upload_tier`: upload quota tier, default `limited`.
- `upload_retained_file_count`: retained staged/uploaded file count.
- `upload_retained_storage_bytes`: retained upload storage bytes.
- `last_seen_at`: latest activity timestamp.
- `prev_last_seen_at`: previous persisted activity timestamp.
- `created_at`, `updated_at`.

Important indexes:

- `idx_user_registry_status`
- `idx_user_registry_polling`
- `idx_user_registry_uploads`
- `idx_user_registry_upload_queue`
- `idx_user_registry_upload_tier`
- `idx_user_registry_last_seen`
- `idx_user_registry_created_at`

Design notes:

- `db_path` identifies the intended user database path. It does not need to
  imply that the file already exists.
- `has_active_rules`, upload counters, and activity timestamps allow background
  services to decide which users need work without opening every user database.

### `api_keys`

Stores encrypted TorBox API keys.

Important columns:

- `id`: primary key.
- `auth_id`: unique foreign key to `user_registry.auth_id`.
- `encrypted_key`: encrypted TorBox API key.
- `key_name`: optional display name.
- `is_active`: whether the key is usable.
- `created_at`, `updated_at`.

Important indexes:

- `idx_api_keys_active`

Design notes:

- API key rows cascade when the owning `user_registry` row is deleted.
- User routes should authenticate with the API key where possible; legacy
  direct-backend `authId` support exists for backward compatibility.

### `pending_actions`

Persists automation actions that need to survive restarts.

Important columns:

- `id`: primary key.
- `auth_id`: owning user.
- `payload`: serialized action payload.
- `rule_id`: optional automation rule id for cancellation/deduplication.
- `created_at`.

Important indexes:

- `idx_pending_actions_auth_id`
- `idx_pending_actions_auth_rule`
- `idx_pending_actions_created_at`

Design notes:

- This table intentionally lives in the master database so queued actions can be
  recovered before or independently of per-user engine caches.

## User Databases

Each user database is independent and stores that user's feature data. User
databases are opened through `UserDatabaseManager`, configured with WAL mode,
foreign keys, busy timeout, and the configured SQLite cache size.

### `schema_migrations`

Tracks applied user migrations for the specific user database.

### Automation Tables

#### `automation_rules`

Stores the user's automation rules.

Important columns:

- `id`
- `name`
- `enabled`
- `trigger_config`
- `conditions`
- `action_config`
- `metadata`
- `cooldown_minutes`
- `last_executed_at`
- `last_evaluated_at`
- `execution_count`
- `asset_types`: JSON text, defaulting to torrent rules for older rows.
- `created_at`, `updated_at`.

Important indexes:

- `idx_automation_rules_enabled`
- `idx_automation_rules_cooldown`
- `idx_automation_rules_evaluation`

#### `rule_execution_log`

Stores execution history for automation rules.

Important columns:

- `id`
- `rule_id`
- `rule_name`
- `execution_type`
- `items_processed`
- `success`
- `error_message`
- `executed_at`

Important indexes:

- `idx_rule_execution_log_rule_id`

#### `torrent_shadow`, `torrent_telemetry`, `speed_history`

These tables store per-user torrent polling state and derived telemetry for
automation conditions.

Important relationships:

- `torrent_telemetry.torrent_id` references `torrent_shadow.torrent_id`.
- `speed_history.torrent_id` references `torrent_shadow.torrent_id`.

Important indexes:

- `idx_torrent_telemetry_stalled_since`
- `idx_speed_history_torrent_timestamp`
- `idx_speed_history_timestamp`

### User Feature Tables

#### `archived_downloads`

Stores archived torrent metadata.

Important columns:

- `id`
- `torrent_id`
- `hash`
- `tracker`
- `name`
- `archived_at`
- `created_at`

Important indexes:

- `idx_archived_downloads_torrent_id`
- `idx_archived_downloads_hash`
- `idx_archived_downloads_archived_at`
- `idx_archived_downloads_unique_torrent`

#### `custom_views`

Stores saved downloads-list views.

Important columns:

- `id`
- `name`
- `filters`
- `sort_field`
- `sort_direction`
- `visible_columns`
- `asset_type`
- `search_query`
- `sort_order`
- `created_at`, `updated_at`

Important indexes:

- `idx_custom_views_name`
- `idx_custom_views_asset_type`
- `idx_custom_views_sort_order`

#### `tags` and `download_tags`

Stores user-defined tags and download-to-tag mappings.

Important columns:

- `tags.id`
- `tags.name`
- `download_tags.tag_id`
- `download_tags.download_id`

Important relationships:

- `download_tags.tag_id` references `tags.id` with cascade delete.
- `download_tags` enforces `UNIQUE(tag_id, download_id)`.

Important indexes:

- `idx_tags_name`
- `idx_download_tags_tag_id`
- `idx_download_tags_download_id`

#### `protected_downloads`

Stores destructive-operation protection flags.

Important columns:

- `download_id`: primary key.
- `protected_at`.

### Upload Tables

#### `uploads`

Stores queued and historical upload work.

Important columns:

- `id`
- `type`: `torrent`, `usenet`, or `webdl`.
- `upload_type`
- `file_path`
- `url`
- `name`
- `status`
- `error_message`
- `retry_count`
- `seed`
- `allow_zip`
- `as_queued`
- `password`
- `queue_order`
- `next_attempt_at`
- `last_processed_at`
- `completed_at`
- `file_deleted`
- `torbox_hash`
- `torbox_torrent_id`
- `torbox_auth_id`
- `add_only_if_cached`
- `file_size_bytes`
- `created_at`, `updated_at`

Important indexes:

- `idx_uploads_status`
- `idx_uploads_queue_order`
- `idx_uploads_created_at`
- `idx_uploads_dequeue`
- `idx_uploads_file_deleted`

#### `upload_attempts`

Stores upload processor API-attempt history for rate-limit and debugging needs.

Important columns:

- `id`
- `upload_id`
- `type`
- `status_code`
- `success`
- `error_code`
- `error_message`
- `attempted_at`

Important indexes:

- `idx_upload_attempts_type_time`
- `idx_upload_attempts_upload_id`
- `idx_upload_attempts_attempted_at`

### Link History

#### `link_history`

Stores generated download links.

Important columns:

- `id`
- `item_id`
- `file_id`
- `url`
- `asset_type`
- `item_name`
- `file_name`
- `generated_at`
- `status`
- `created_at`

Important indexes:

- `idx_link_history_item_file`
- `idx_link_history_generated_at`
- `idx_link_history_item_id`
- `idx_link_history_item_name`

## Background Service Expectations

Background services should use master database metadata to avoid opening user
databases unnecessarily.

- Polling should use `has_active_rules`, `next_poll_at`, `last_seen_at`, and
  related master fields to decide whether a user is due.
- Upload processing should use `queued_uploads_count` and
  `next_upload_attempt_at`.
- Upload quota enforcement should use master quota counters first, then open a
  user database only when it must inspect or mutate upload rows.
- Admin scans should prefer filesystem stats and master counters; opening every
  user database is expensive and should be bounded.

## Lazy User Database Provisioning

Lazy provisioning is viable with the current schema. The master database already
contains enough metadata to register users, store encrypted API keys, track
activity, and schedule background work without requiring an empty user database.

The safest design is to keep `user_registry.db_path` as the intended future path
and treat physical file existence as the boundary between "registered user" and
"provisioned user database".

Recommended API split in `UserDatabaseManager`:

- `ensureUserDatabase(authId)`: create/open/migrate the user database.
- `getExistingUserDatabase(authId)`: open/migrate only if the user database file
  already exists; return `null` otherwise.
- `userDatabaseExists(authId)`: check the pool and/or filesystem without
  creating the database.

Compatibility guidance:

- Existing users with database files should behave unchanged.
- API key registration should not create a user database.
- Read-only feature endpoints should return empty/default responses when the
  user database does not exist.
- Mutating feature endpoints should validate the request first, then call the
  centralized provisioning method only when persistence is genuinely required.
- Startup, admin, and scheduler scans must not call a create-on-open API when
  they only need to inspect existing data.
- User migrations should continue to run when a database is first provisioned or
  when an existing database is opened after a deploy.

Main breakage risks if lazy provisioning is implemented carelessly:

- A frontend or backend "ensure DB" preflight can silently recreate eager
  provisioning.
- Read-only routes can create thousands of empty databases if they continue to
  call a create-on-open method.
- Startup repair jobs can create every missing user database if they scan all
  registered users with a provisioning API.
- Admin metrics and automation pages can create databases during observation.
- Invalid mutating requests can create empty databases if provisioning happens
  before validation.

If those risks are addressed with the API split above, lazy provisioning should
not break existing deployments and should substantially reduce empty database
file creation for new users.

## Migration Guidance

- Keep migrations idempotent.
- User migrations must tolerate being applied to a brand-new database long after
  the user registered.
- Master migrations should preserve backward compatibility for existing
  deployments.
- Avoid storing user-owned feature data in the master database unless it is
  needed for cross-user scheduling, queue selection, activity tracking, quota
  accounting, or admin summaries.
- If a new feature needs per-user persistence, its first write should be the
  provisioning point. Its read-only endpoints should define an empty response
  for unprovisioned users.
