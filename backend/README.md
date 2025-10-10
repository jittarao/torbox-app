# TorBox Backend

A lightweight Node.js backend for TorBox Manager that provides 24/7 automation and persistent data storage.

## Features

- **24/7 Automation**: Run automation rules continuously in the background
- **Persistent Storage**: SQLite database for data persistence
- **REST API**: Simple API for frontend integration
- **Cron Jobs**: Scheduled task execution
- **Health Monitoring**: Built-in health checks and logging

## Quick Start

### Docker (Recommended)

1. Start the backend:
```bash
docker compose -f docker-compose.selfhosted.yml up -d
```

2. The backend will be available at `http://localhost:3001`

### Local Development

1. Install dependencies:
```bash
cd backend
npm install
```

2. Set environment variables:
```bash
cp env.example .env
# Edit .env with your settings
```

3. Start the server:
```bash
npm start
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TORBOX_API_KEY` | Your TorBox API key | Optional |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |
| `PORT` | Backend port | `3001` |

### API Endpoints

- `GET /api/backend/status` - Backend status
- `GET /api/automation/rules` - Get automation rules
- `POST /api/automation/rules` - Save automation rules
- `GET /health` - Health check

## Architecture

- **Express.js** - Web framework
- **SQLite** - Local database
- **node-cron** - Task scheduling
- **Helmet** - Security headers
- **CORS** - Cross-origin requests

## Requirements

- Node.js 18.0 or later
- Docker (for containerized deployment)
- TorBox API access

## License

[GNU Affero General Public License v3.0](https://choosealicense.com/licenses/agpl-3.0/)