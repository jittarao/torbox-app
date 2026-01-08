# TorBox Backend

A lightweight, multi-user backend for TorBox Manager that provides 24/7 automation, persistent data storage, and per-user database isolation.

## Features

- **Multi-User Architecture**: Separate database per user for complete data isolation
- **24/7 Automation**: Run automation rules continuously in the background
- **Intelligent Polling**: Adaptive polling based on user activity and rule status
- **State Diffing**: Efficient change detection for torrent state updates
- **Speed Aggregation**: Hourly speed averages for condition evaluation
- **Connection Pooling**: LRU cache for efficient database connection management (200+ users)
- **Persistent Storage**: SQLite databases for user data, PostgreSQL for master registry
- **REST API**: Simple API for frontend integration
- **Health Monitoring**: Built-in health checks and logging
- **Encrypted API Keys**: Secure storage of user API keys

## Architecture

### Database Structure

- **Master Database** (PostgreSQL):
  - `user_registry`: User accounts and metadata
  - `api_keys`: Encrypted API key storage
  - Tracks user status, polling schedules, and active rules

- **User Databases** (SQLite, one per user):
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

### Docker (Recommended)

1. Set environment variables in `.env`:
```bash
ENCRYPTION_KEY=your-base64-encryption-key-here
FRONTEND_URL=http://localhost:3000
```

2. Generate an encryption key:
```bash
# Windows PowerShell:
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

# macOS/Linux:
openssl rand -base64 32
```

3. Start the backend:
```bash
docker compose up -d torbox-backend
```

4. The backend will be available at `http://localhost:3001`

### Local Development

1. Install dependencies:
```bash
cd backend
bun install
```

2. Set environment variables:
```bash
cp .env.example .env
# Edit .env with your settings
```

3. Start the server:
```bash
bun start
```

5. For development with auto-reload:
```bash
bun run dev
```

## Configuration

### Environment Variables

| Variable            | Description                                      | Default                      | Required   |
|---------------------|--------------------------------------------------|------------------------------|------------|
| `FRONTEND_URL`      | Frontend URL for CORS                            | `http://localhost:3000`      | Yes        |
| `ENCRYPTION_KEY`    | Base64-encoded key for API key encryption        | -                            | Yes        |
| `PORT`              | Port for backend server                          | `3001`                       | Yes        |
| `NODE_ENV`          | Node environment                                 | `production`                 | Yes        |
| `TORBOX_API_BASE`   | TorBox API base URL                              | `https://api.torbox.app`     | No         |
| `TORBOX_API_VERSION`| TorBox API version                               | `v1`                         | No         |
| `MASTER_DB_PATH`    | Directory for master database                    | `/app/data/master.db`        | No         |
| `USER_DB_DIR`       | Directory for user database files                | `/app/data/users`            | No         |
| `MAX_DB_CONNECTIONS`| Maximum pooled database connections              | `200`                        | No         |

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
  - Applied to the master database (PostgreSQL)
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

- Node.js 18.0 or later
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
