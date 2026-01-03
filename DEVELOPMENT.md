# Development Guide

This guide will help you set up the TorBox Manager multi-user backend architecture for local development.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running the Services](#running-the-services)
- [Development Workflow](#development-workflow)
- [Architecture Overview](#architecture-overview)
- [Troubleshooting](#troubleshooting)
- [Testing](#testing)

## Prerequisites

### Required Software

1. **Node.js 18+** or **Bun 1.0+**
   - Download Node.js: https://nodejs.org/
   - Download Bun: https://bun.sh/

2. **PostgreSQL 16+** or **Docker Desktop**
   - PostgreSQL: https://www.postgresql.org/download/
   - Docker Desktop: https://www.docker.com/products/docker-desktop

3. **Git**
   - Download: https://git-scm.com/downloads

### Optional Tools

- **pgAdmin** or **DBeaver** - PostgreSQL GUI clients
- **Postman** or **Insomnia** - API testing tools

## Quick Start

### Windows 11

```powershell
# 1. Clone the repository
git clone https://github.com/jittarao/torbox-app.git
cd torbox-app

# 2. Start PostgreSQL with Docker
docker compose up -d postgres

# 3. Create .env.local file in project root with:
# Copy contents in .env.example and generate your ENCRYPTION_KEY

# 4. Install dependencies
npm install
cd worker && npm install && cd ..

# 5. Start Next.js (Terminal 1)
npm run dev

# 6. Start Worker (Terminal 2)
cd worker
npm run dev
```

### macOS / Linux

```bash
# 1. Clone the repository
git clone https://github.com/jittarao/torbox-app.git
cd torbox-app

# 2. Start PostgreSQL with Docker
docker compose up -d postgres

# 3. Create .env.local file
cp .env.example .env.local
# Edit .env.local and set your ENCRYPTION_KEY

# 4. Install dependencies
npm install
cd worker && npm install && cd ..

# 5. Start Next.js (Terminal 1)
npm run dev

# 6. Start Worker (Terminal 2)
cd worker && npm run dev
```

## Detailed Setup

### Step 1: Database Setup

#### Option A: Using Docker (Recommended)

Docker is the easiest way to run PostgreSQL locally:

```bash
# Start PostgreSQL container
docker compose up -d postgres

# Verify it's running
docker ps | grep torbox-postgres

# View logs if needed
docker logs torbox-postgres
```

The database will be available at `localhost:5432` with:
- Database: `torbox`
- User: `torbox`
- Password: `changeme` (or your `POSTGRES_PASSWORD` env var)

#### Option B: Local PostgreSQL Installation

1. **Install PostgreSQL**
   - Windows: Download installer from https://www.postgresql.org/download/windows/
   - macOS: `brew install postgresql@16`
   - Linux: `sudo apt-get install postgresql-16` (Ubuntu/Debian)

2. **Create Database and User**

```sql
-- Connect to PostgreSQL as superuser
psql -U postgres

-- Create database and user
CREATE DATABASE torbox;
CREATE USER torbox WITH PASSWORD 'changeme';
GRANT ALL PRIVILEGES ON DATABASE torbox TO torbox;

-- Connect to the new database
\c torbox

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO torbox;
```

3. **Update Connection String**

Update your `.env.local`:
```env
DATABASE_URL=postgresql://torbox:changeme@localhost:5432/torbox
```

### Step 2: Environment Variables

Create a `.env.local` file in the project root (this file is gitignored and won't be committed):

**Note**: See the example configuration below. Copy and paste into your `.env.local` file, then update the values.

```env
# Multi-User Backend Configuration
# Set to 'true' to enable PostgreSQL-based multi-user backend features
# When disabled, the app runs in frontend-only mode (localStorage)
# Default: false (disabled)
MULTI_USER_BACKEND_ENABLED=true

# Database Configuration (REQUIRED if MULTI_USER_BACKEND_ENABLED=true)
DATABASE_URL=postgresql://torbox:changeme@localhost:5432/torbox

# Encryption Key (REQUIRED if MULTI_USER_BACKEND_ENABLED=true)
# Generate a secure random string (minimum 32 characters recommended)
# Windows PowerShell:
#   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
# macOS/Linux:
#   openssl rand -base64 32
# Or use: https://www.random.org/strings/
ENCRYPTION_KEY=CHANGE_THIS_TO_A_SECURE_RANDOM_STRING_AT_LEAST_32_CHARACTERS_LONG

# Polling Configuration
# Target interval: How often all users should be polled (in minutes)
POLLING_INTERVAL_MINUTES=30

# Internal interval: How often the worker checks for users to poll (in minutes)
POLLING_INTERVAL_INTERNAL_MINUTES=2

# Snapshot retention: How many days to keep torrent snapshots
SNAPSHOT_RETENTION_DAYS=30

# Database connection pool size
DB_POOL_SIZE=20

# Worker Configuration
# Enable worker in Next.js (set to false to disable)
WORKER_ENABLED=true

# Worker server port
WORKER_PORT=3002

# TorBox API Configuration (optional, defaults shown)
TORBOX_API_BASE=https://api.torbox.app
TORBOX_API_VERSION=v1

# PostgreSQL Password (for Docker Compose)
# Only needed if using docker-compose.yml
POSTGRES_PASSWORD=changeme
```

**Important**: Never commit `.env.local` to git. It's already in `.gitignore`.

### Step 3: Install Dependencies

```bash
# Install main project dependencies
npm install
# or with Bun:
bun install

# Install worker dependencies
cd worker
npm install
# or:
bun install
cd ..
```

### Step 4: Database Migrations

Migrations run automatically when the Next.js server starts. The first time you run:

```bash
npm run dev
```

You should see output like:
```
PostgreSQL connection established
Running database migrations...
Running migration 001_create_multi_user_schema...
✓ Migration 001_create_multi_user_schema applied successfully
Applied 1 migration(s)
Database initialized successfully
```

### Step 5: Start Development Servers

You need to run two services:

#### Terminal 1: Next.js Application

```bash
npm run dev
```

The app will be available at: http://localhost:3000

#### Terminal 2: Worker Server

```bash
cd worker
npm install  # Install worker dependencies
npm run dev
```

The worker will be available at: http://localhost:3002

**Worker Health Check**: http://localhost:3002/health

**Note**: The worker automatically loads environment variables from `.env.local` in the project root directory. Make sure you've created this file before starting the worker.

## Environment Variables

### Required Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `MULTI_USER_BACKEND_ENABLED` | Enable multi-user backend (PostgreSQL + Worker) | `true` or `false` | No (default: `false`) |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/torbox` | Yes (if backend enabled) |
| `ENCRYPTION_KEY` | Key for encrypting API keys (min 32 chars) | Generated random string | Yes (if backend enabled) |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POLLING_INTERVAL_MINUTES` | Target polling interval for all users | `30` |
| `POLLING_INTERVAL_INTERNAL_MINUTES` | Internal polling interval | `2` |
| `SNAPSHOT_RETENTION_DAYS` | Days to keep snapshots | `30` |
| `DB_POOL_SIZE` | PostgreSQL connection pool size | `20` |
| `WORKER_ENABLED` | Enable worker in Next.js | `true` |
| `WORKER_PORT` | Worker server port | `3002` |
| `TORBOX_API_BASE` | TorBox API base URL | `https://api.torbox.app` |
| `TORBOX_API_VERSION` | TorBox API version | `v1` |

## Database Setup

### Schema Overview

The database consists of the following tables:

- **users** - Stores user API keys (encrypted) and metadata
- **torrent_snapshots** - Historical torrent states for metrics
- **automation_rules** - Per-user automation rules
- **rule_execution_log** - Execution history for debugging

### Manual Migration (if needed)

If you need to run migrations manually:

```bash
# Create a migration script (if needed)
node -e "
import('./src/database/PostgresDatabase.js').then(async ({ default: DB }) => {
  const db = new DB();
  await db.initialize();
  process.exit(0);
});
"
```

### Database Reset (Development Only)

⚠️ **Warning**: This will delete all data!

```sql
-- Connect to database
psql -U torbox -d torbox

-- Drop all tables
DROP TABLE IF EXISTS rule_execution_log CASCADE;
DROP TABLE IF EXISTS automation_rules CASCADE;
DROP TABLE IF EXISTS torrent_snapshots CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS schema_migrations CASCADE;

-- Restart Next.js to run migrations again
```

## Running the Services

### Development Mode

**Next.js** (with hot reload):
```bash
npm run dev
```

**Worker** (with watch mode):
```bash
cd worker
npm run dev
```

### Production Mode (Testing)

**Next.js**:
```bash
npm run build
npm start
```

**Worker**:
```bash
cd worker
npm start
```

### Using Docker Compose (Full Stack)

To run everything with Docker:

```bash
# Create .env file with all required variables
cp .env.example .env

# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

## Development Workflow

### 1. Making Database Changes

1. Create a new migration file:
```bash
# Migration files are in src/database/migrations/
# Format: XXX_description.js (e.g., 002_add_user_preferences.js)
```

2. Migration template:
```javascript
export const up = async (client) => {
  await client.query(`
    -- Your migration SQL here
  `);
};

export const down = async (client) => {
  await client.query(`
    -- Rollback SQL here
  `);
};
```

3. Migrations run automatically on server start

### 2. Adding New API Routes

1. Create route file in `src/app/api/[route-name]/route.js`
2. Use `getDatabase()` from `@/database/db` for database access
3. Always check for database availability:
```javascript
const db = getDatabase();
if (!db) {
  return NextResponse.json(
    { success: false, error: 'Database not configured' },
    { status: 503 }
  );
}
```

### 3. Adding Worker Jobs

1. Add job scheduling in `worker/src/scheduler/JobScheduler.js`
2. Create job handler in appropriate module
3. Use cron expressions for scheduling

### 4. Testing API Routes

Use the API routes directly:

```bash
# Register a user (replace YOUR_API_KEY)
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "YOUR_API_KEY"}'

# Get user info
curl http://localhost:3000/api/users/me \
  -H "x-api-key: YOUR_API_KEY"

# Get snapshots
curl http://localhost:3000/api/snapshots \
  -H "x-api-key: YOUR_API_KEY"
```

## Architecture Overview

### System Components

```
┌─────────────────┐
│   Next.js App   │  Port 3000
│  (Frontend +    │  - User API routes
│   API Routes)   │  - Snapshot API
└────────┬────────┘  - Automation Rules API
         │
         │ Reads/Writes
         ▼
┌─────────────────┐
│   PostgreSQL    │  Port 5432
│   Database     │  - Users
│                │  - Snapshots
│                │  - Rules
└────────┬────────┘
         │
         │ Reads/Writes
         ▼
┌─────────────────┐
│  Worker Server  │  Port 3002
│  (Background)   │  - Polls TorBox API
│                 │  - Creates Snapshots
│                 │  - Executes Automation
└────────┬────────┘
         │
         │ API Calls
         ▼
┌─────────────────┐
│  TorBox API     │
│  (External)     │
└─────────────────┘
```

### Data Flow

1. **User Registration**: User provides API key → Encrypted and stored in `users` table
2. **Polling**: Worker polls TorBox API → Creates snapshots in `torrent_snapshots` table
3. **Automation**: Worker reads rules → Evaluates conditions using snapshots → Fetches live data → Executes actions
4. **Frontend**: Next.js API routes read from database → Return data to frontend

## Troubleshooting

### Database Connection Issues

**Error**: `Database not configured` or `DATABASE_URL environment variable is required`

**Solutions**:
1. Check `.env.local` exists and contains `DATABASE_URL`
2. Verify PostgreSQL is running:
   ```bash
   # Docker
   docker ps | grep postgres
   
   # Local
   pg_isready -h localhost -p 5432
   ```
3. Test connection:
   ```bash
   psql $DATABASE_URL
   ```

### Migration Errors

**Error**: Migration fails or tables don't exist

**Solutions**:
1. Check migration files in `src/database/migrations/`
2. Verify `schema_migrations` table exists
3. Check database logs for specific errors
4. Manually run migrations if needed (see Database Setup section)

### Worker Not Polling

**Symptoms**: No snapshots being created

**Solutions**:
1. Check worker is running: http://localhost:3002/health
2. Verify users exist in database:
   ```sql
   SELECT id, is_active, next_poll_at FROM users;
   ```
3. Check worker logs for errors
4. Verify `ENCRYPTION_KEY` is set correctly

### Encryption Key Issues

**Error**: `ENCRYPTION_KEY environment variable is required`

**Solutions**:
1. Ensure `.env.local` contains `ENCRYPTION_KEY`
2. Key must be at least 32 characters
3. Restart both Next.js and Worker after changing key
4. **Note**: Changing encryption key will make existing encrypted data unreadable

### Port Conflicts

**Error**: `Port 3000 is already in use` or `Port 3002 is already in use`

**Solutions**:
1. Find and stop the conflicting process:
   ```bash
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   
   # macOS/Linux
   lsof -ti:3000 | xargs kill
   ```
2. Or change ports in `.env.local`:
   ```env
   WORKER_PORT=3003
   ```

### Module Type Warning

**Warning**: `MODULE_TYPELESS_PACKAGE_JSON` warning when running worker

This is a harmless warning from Node.js. The worker uses ES modules (has `"type": "module"` in `worker/package.json`), but the root `package.json` doesn't specify a module type because Next.js handles modules differently. This warning can be safely ignored and doesn't affect functionality.

### API Key Registration Fails

**Error**: `Invalid API key or TorBox API unavailable`

**Solutions**:
1. Verify your TorBox API key is correct
2. Check TorBox API is accessible:
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" \
        https://api.torbox.app/v1/api/health
   ```
3. Check network/firewall settings

## Testing

### Manual Testing

1. **Register a User**:
   - Open http://localhost:3000
   - Enter your TorBox API key
   - Check database: `SELECT * FROM users;`

2. **Verify Polling**:
   - Wait 2-5 minutes
   - Check snapshots: `SELECT COUNT(*) FROM torrent_snapshots;`
   - Check worker logs for polling activity

3. **Test Automation**:
   - Create a rule in the UI
   - Check database: `SELECT * FROM automation_rules;`
   - Wait for automation job (runs every 5 minutes)
   - Check execution log: `SELECT * FROM rule_execution_log;`

### Database Queries for Testing

```sql
-- Check registered users
SELECT id, created_at, is_active, last_polled_at, next_poll_at 
FROM users;

-- Check snapshots
SELECT user_id, torrent_id, state, created_at 
FROM torrent_snapshots 
ORDER BY created_at DESC 
LIMIT 10;

-- Check automation rules
SELECT id, user_id, name, enabled 
FROM automation_rules;

-- Check rule executions
SELECT rule_id, items_processed, success, executed_at 
FROM rule_execution_log 
ORDER BY executed_at DESC 
LIMIT 10;
```

### API Testing with curl

```bash
# Set your API key
export API_KEY="your-torbox-api-key"

# Register user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d "{\"apiKey\": \"$API_KEY\"}"

# Get user info
curl http://localhost:3000/api/users/me \
  -H "x-api-key: $API_KEY"

# Get snapshots
curl http://localhost:3000/api/snapshots \
  -H "x-api-key: $API_KEY"

# Get automation rules
curl http://localhost:3000/api/automation/rules \
  -H "x-api-key: $API_KEY"
```

## Useful Commands

### Database

```bash
# Connect to database (Docker)
docker exec -it torbox-postgres psql -U torbox -d torbox

# Connect to database (Local)
psql -U torbox -d torbox

# Backup database
pg_dump $DATABASE_URL > backup.sql

# Restore database
psql $DATABASE_URL < backup.sql
```

### Docker

```bash
# View logs
docker compose logs -f

# Restart services
docker compose restart

# Stop services
docker compose down

# Remove volumes (⚠️ deletes data)
docker compose down -v
```

### Development

```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules and reinstall
rm -rf node_modules worker/node_modules
npm install
cd worker && npm install && cd ..

# Check for linting errors
npm run lint

# Fix linting errors
npm run lint:fix
```

## Contributing

### Code Style

- Follow existing code patterns
- Use async/await for async operations
- Always handle errors gracefully
- Add database null checks in API routes
- Use parameterized queries (never string concatenation)

### Pull Request Process

1. Create a feature branch
2. Make your changes
3. Test locally (see Testing section)
4. Ensure migrations are included if schema changes
5. Update this documentation if needed
6. Submit PR with clear description

### Common Issues

- **Import paths**: Use `@/` alias for `src/` directory
- **Database queries**: Always use parameterized queries
- **Error handling**: Return appropriate HTTP status codes
- **Logging**: Use `console.log` for development, structured logging for production

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Node.js pg Documentation](https://node-postgres.com/)
- [Docker Documentation](https://docs.docker.com/)

## Getting Help

If you encounter issues:

1. Check this troubleshooting section
2. Review error logs in console
3. Check database connection and migrations
4. Verify environment variables are set correctly
5. Open an issue on GitHub with:
   - Error messages
   - Steps to reproduce
   - Environment details (OS, Node version, etc.)

---

**Happy Coding! 🚀**
