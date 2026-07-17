# TorBox Backend

A lightweight, multi-user backend for TorBox Manager that provides 24/7 automation, persistent data storage, and per-user database isolation.

## Features

- **Multi-User Architecture**: Separate database per user for complete data isolation
- **24/7 Automation**: Run automation rules continuously in the background
- **Intelligent Polling**: Adaptive polling based on user activity and rule status
- **State Diffing**: Efficient change detection for torrent state updates
- **Speed Aggregation**: Hourly speed averages for condition evaluation
- **Connection Pooling**: LRU cache for efficient database connection management (200+ users)
- **Persistent Storage**: SQLite for master registry and per-user databases
- **REST API**: Simple API for frontend integration
- **Health Monitoring**: Built-in health checks and logging
- **Encrypted API Keys**: Secure storage of user API keys

## Architecture

### Database Structure

- **Master Database** (SQLite, `data/master.db`):
  - `user_registry`: User accounts and metadata
  - `api_keys`: Encrypted API key storage
  - Tracks user status, polling schedules, and active rules

- **User Databases** (SQLite, one per user in `data/users/`):
  - `automation_rules`: User's automation rules
  - `rule_execution_log`: Rule execution history
  - `torrent_shadow`: Last seen torrent state
  - `torrent_telemetry`: Derived fields (stalled time, activity timestamps)
  - `speed_history`: Per-poll speed samples
  - `archived_downloads`: Archived torrent information

### Automation Engine

The automation engine consists of several components:

1. **AutomationEngine**: Per-user rule evaluation and execution
2. **RuleEvaluator**: Condition evaluation against torrent data
3. **StateDiffEngine**: Detects changes in torrent state
4. **DerivedFieldsEngine**: Computes derived fields (stalled time, activity)
5. **SpeedAggregator**: Aggregates speed samples into hourly averages
6. **PollingScheduler**: Determines when to poll each user
7. **UserPoller**: Handles API polling and rule execution

## Quick Start

For deployment instructions, see [DEPLOYMENT.md](../DEPLOYMENT.md).

### API Endpoints

#### User Management

- `POST /api/backend/api-key/ensure-db` - Ensure user database exists
- `GET /api/backend/status` - Backend status and statistics

#### Automation Rules

- `GET /api/automation/rules` - Get all automation rules for user
- `POST /api/automation/rules` - Create or update automation rules
- `GET /api/automation/rules/:id` - Get specific rule
- `PUT /api/automation/rules/:id` - Update specific rule (e.g., enable/disable)
- `DELETE /api/automation/rules/:id` - Delete specific rule
- `GET /api/automation/rules/:id/logs` - Get rule execution logs

#### Archived Downloads

- `GET /api/archived-downloads` - List archived downloads
- `POST /api/archived-downloads` - Archive a download
- `GET /api/archived-downloads/:id` - Get archived download details
- `DELETE /api/archived-downloads/:id` - Restore archived download

#### Health

- `GET /health` - Health check endpoint

## Database Migrations

The backend uses a dual-migration system:

- **Master Migrations**: Located in `src/database/migrations/master/`
  - Applied to the master SQLite database
  - Manages user registry and API key storage

- **User Migrations**: Located in `src/database/migrations/user/`
  - Applied to each user's SQLite database
  - Manages automation rules, telemetry, and user-specific data

Migrations are automatically applied when databases are initialized. See [migrations/README.md](src/database/migrations/README.md) for details.

## Automation Rules

Automation rules allow users to automatically manage their torrents based on conditions:

### Condition Types

- **Lifecycle**: Status, is_active, expires_at
- **Seeding**: Ratio, seeding_time, seeds, peers, upload_speed, avg_upload_speed
- **Downloading**: ETA, progress, download_speed, avg_download_speed
- **Stall & Inactivity**: download_stalled_time, upload_stalled_time
- **Metadata**: Age, tracker, availability, file_size, file_count, name

### Actions

- `stop_seeding`: Stop seeding when conditions are met
- `archive`: Archive torrent for later restoration
- `delete`: Delete torrent permanently
- `force_start`: Force start torrent

### Rule Evaluation

Rules are evaluated on each polling cycle:

1. Fetch current torrent state from TorBox API
2. Compute state diffs to detect changes
3. Derive fields (stalled time, activity timestamps)
4. Aggregate speed samples into hourly averages
5. Evaluate all enabled rules against torrent data
6. Execute actions for matching torrents
7. Log execution results

## Authentication & network security

### How users are identified

| Concept            | Meaning                                                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TorBox API key** | Secret credential from [torbox.app/settings](https://torbox.app/settings). Proves the caller owns the account.                                             |
| **`authId`**       | `SHA-256(apiKey)` — stable 64-char hex id used for DB filenames and queries. Identifies the user; **not** equivalent to proving possession of the API key. |

### Request paths (Express `requireRegisteredUser`)

All user data routes (`/api/automation/*`, `/api/uploads/*`, `/api/tags/*`, `/api/custom-views/*`, `/api/archived-downloads/*`, `/api/link-history/*`, `/api/downloads/tags`, etc.) use the same middleware:

1. **If `x-api-key` is present** — Backend hashes it, optionally matches `authId`, verifies registry. This is what **every Next.js proxy uses** (`backendProxyHeaders` or explicit `'x-api-key'` header). No app route sends `authId` to the backend without also sending `x-api-key`.
2. **Legacy (default, direct backend only)** — If there is **no** `x-api-key` but a valid `authId` query/body/header, the backend still accepts the request. This path exists for backward compatibility when something calls port `3001` directly (custom scripts, old integrations). It is **not** used by the stock TorBox Manager UI.

Some Next.js handlers also add `?authId=` on the backend URL for convenience; that is redundant when `x-api-key` is already set. Browsers only call `https://your-domain/api/...` (Next.js), not `:3001`.

### Optional environment variables

| Variable                  | Default         | Purpose                                                                                                                                                                                             |
| ------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BACKEND_REQUIRE_API_KEY` | unset (`false`) | When `true`, user routes reject `authId`-only requests. Use when port `3001` is exposed on the public internet.                                                                                     |
| `BACKEND_SERVICE_SECRET`  | unset           | Same value on frontend and backend; Next.js sends `x-backend-service-secret` on internal routes (`/api/backend/api-key*`). Optional hardening when something besides Next.js can reach the backend. |
| `ADMIN_API_KEY`           | unset           | Protects `/api/admin/*`; if unset, admin API returns 503.                                                                                                                                           |

**Typical self-hosted production** (Caddy → `localhost:3000`, Docker `127.0.0.1:3001:3001`, frontend `BACKEND_URL=http://torbox-backend:3001`): you do **not** need to set `BACKEND_REQUIRE_API_KEY` or `BACKEND_SERVICE_SECRET`. Startup log warnings about legacy auth are informational.

See [DEPLOYMENT.md](../DEPLOYMENT.md#backend-authentication--network-layout) for the recommended network diagram.

## Configuration

### Rate limiting

The backend applies two layers of rate limits (15-minute windows):

| Variable               | Description                                                           | Default |
| ---------------------- | --------------------------------------------------------------------- | ------- |
| `IP_RATE_LIMIT_MAX`    | Max requests per IP on `/api/*` (public/direct access)                | `1000`  |
| `USER_RATE_LIMIT_MAX`  | Max requests per authenticated user (`authId`)                        | `500`   |
| `ADMIN_RATE_LIMIT_MAX` | Max requests per IP on admin routes                                   | `100`   |
| `TRUST_PROXY`          | Set to `true` when behind a reverse proxy that sets `X-Forwarded-For` | unset   |

When the Next.js frontend proxies to the backend (typical Docker Compose setup), traffic arrives from a private container IP. Those addresses are **not** counted against the IP limit, so normal app use does not share one global bucket. The IP limit mainly protects the backend if port `3001` is exposed directly on the internet.

Override via environment variables (see `.env.example` in the repo root or `backend/.env.local.example` for local dev).

### Upload retention quotas

LIMITED tier users (default for all new users) have staged upload files capped by **both** limits below. UNLIMITED users bypass enforcement. Tier is stored in `user_registry.upload_tier` and managed via admin API/UI (`PUT /api/admin/users/:authId/upload-tier`).

| Variable                                  | Description                                                                        | Default |
| ----------------------------------------- | ---------------------------------------------------------------------------------- | ------- |
| `UPLOAD_LIMIT_MAX_STORAGE_MB`             | Max total staged upload storage per LIMITED user                                   | `100`   |
| `UPLOAD_LIMIT_MAX_FILES`                  | Max retained staged files per LIMITED user                                         | `500`   |
| `AUTOMATION_INACTIVE_USER_DAYS`           | Skip automation polling for users inactive N days (`last_seen_at`; `0` disables)   | `30`    |
| `AUTOMATION_RULES_MYLIST_FULL_PAGINATION` | When `true`/`1`, automation rules fetch every TorBox mylist page (libraries >1000) | unset   |

Implementation: `src/services/UploadQuotaService.js`, config in `src/config/uploadQuota.js`. Counters are cached in the master DB; startup backfill reconciles usage from per-user SQLite + disk.

## User activity tracking

Engagement is recorded via a **frontend beacon** (`ActivityBeacon` → `POST /api/backend/activity` → `ActivityTracker`).

### Update strategy

1. Browser posts activity every ~2 minutes while the tab is visible and an API key is present.
2. `ActivityTracker.touch(authId)` updates an in-memory `touchedAt` on every accepted beacon.
3. SQLite `user_registry.last_seen_at` is written only when:
   - first activity for the user, or
   - last persist was ≥ **5 minutes** ago.
4. Pending writes are batched every **30 seconds** and flushed on graceful shutdown.

### Online detection

- **Online** = in-memory touch within the last **2 minutes** (no WebSockets).
- Accurate for a single backend instance; multi-instance deployments would need shared memory or accept DB-only online status.

### Schema

- `last_seen_at` — durable last engagement (indexed).
- `prev_last_seen_at` — previous value before last persist (enables returning-user metrics).
- Indexes: `idx_user_registry_last_seen`, `idx_user_registry_created_at`.

### Admin APIs

- `GET /api/admin/metrics/activity` — aggregated counts (online, active windows, inactive buckets, growth, distribution).
- User list supports `?activity=` filter and `sort=last_seen_at` (server-side SQL only).

### Extensibility

Add metrics by extending `queryActivityMetrics()` or incrementing counters in `ActivityTracker.touch()` before flush. Request-count / active-days power-user stats would need middleware counters or a daily rollup table (not beacon-based).

### Automation inactivity gating

`PollingScheduler` excludes users from scheduled polling when `last_seen_at` is set and older than `AUTOMATION_INACTIVE_USER_DAYS` (default `30`). Users with `NULL last_seen_at` remain eligible. Set the env var to `0` to disable.

Manual rule runs and admin trigger polls (`POST /api/admin/users/:authId/trigger-poll`) fast-persist `last_seen_at` when the user issues an authenticated request but the stored value is stale, so returning users are not blocked by the activity beacon's 5-minute debounce. Pending action drains defer inactive users for one hour between re-evaluations.

Stats appear in `GET /api/admin/metrics/polling` (`polling.inactivityFilter`), including per-cycle eligible/skipped counts and cumulative counters (`totalSkippedScheduled`, `totalSkippedManual`, `totalSkippedQueue`).

## Performance

- **Connection Pooling**: LRU cache prevents connection exhaustion
- **WAL Mode**: SQLite WAL mode for better concurrency
- **Intelligent Polling**: Only poll users with active rules or recent activity
- **State Diffing**: Only process torrents with state changes
- **Indexed Queries**: All tables have appropriate indexes for fast lookups

## Architecture

- **Express.js** - Web framework
- **SQLite** - Master and Per-user databases (data isolation)
- **Bun** - High-performance JavaScript runtime
- **Helmet** - Security headers
- **CORS** - Cross-origin requests

## Requirements

- Node.js 18.0 or later (or Bun)
- Docker (for containerized deployment)
- TorBox API access

## Development

### Running Tests

```bash
bun test
```

### Database Management

User databases are automatically created when:

- A user enters an API key in the frontend
- The `/api/backend/api-key/ensure-db` endpoint is called

The master database must be initialized manually or via migration.

## License

[GNU Affero General Public License v3.0](https://choosealicense.com/licenses/agpl-3.0/)
