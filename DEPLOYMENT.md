# Deployment Guide

This guide covers deployment for the TorBox Manager frontend and backend.

**Quick links:** [Docker Compose](#docker-compose-recommended) · [Portainer](#portainer) · [Production + Caddy](#production-deployment-self-hosting-with-docker--caddy) · [Troubleshooting](#troubleshooting)

## Local Development

### Frontend

1. Clone the repository:

```bash
git clone https://github.com/jittarao/torbox-app.git
cd torbox-app
```

2. Install dependencies:

```bash
bun install
```

3. Create a `.env.local` file with the following variables:

```bash
BACKEND_URL=http://localhost:3001
BACKEND_DISABLED=false
```

4. Run the development server:

```bash
bun run dev
```

5. Open [http://localhost:3000](http://localhost:3000) and enter your TorBox API key to begin.

### ffprobe Setup (Audiobook Chapters)

Chapter extraction for the audio player uses **ffprobe** (from FFmpeg). It runs in the **frontend** (Next.js) process via `/api/audiobook/chapters`.

**You only need one of these:**

- **`FFPROBE_PATH`** – Path to an existing ffprobe binary (e.g. from system FFmpeg or Homebrew). When set and the file exists, the app uses it and **does not** use or need a cache directory. No auto-download.
- **Auto-download (no `FFPROBE_PATH`)** – The app downloads a compatible ffprobe build on first use. Where it goes: if **`FFPROBE_AUTO_DIR`** is set, the binary is extracted there; if not set, it uses **`<project>/.ffprobe`** (project root). The resolved path is stored in `<cacheDir>/path.json` for reuse. Auto-bootstrap is supported only on **Windows** and **Linux**; on other platforms you must set `FFPROBE_PATH`.

**Local development:**

- **Windows / Linux – Auto-bootstrap (default):** No setup required. On first chapter extraction, downloads into `<project>/.ffprobe`. Needs outbound HTTPS and (on Windows) PowerShell.
- **macOS:** Auto-bootstrap is not supported. Install FFmpeg (e.g. `brew install ffmpeg`) and set **only** `FFPROBE_PATH` in `.env.local` (no cache dir needed):
  ```bash
  FFPROBE_PATH=/opt/homebrew/bin/ffprobe   # Apple Silicon
  # or
  FFPROBE_PATH=/usr/local/bin/ffprobe     # Intel
  ```
- **Use system ffprobe (Windows / Linux):** Install [FFmpeg](https://ffmpeg.org/) and set **only** `FFPROBE_PATH` in `.env.local`:
  ```bash
  FFPROBE_PATH=C:\path\to\ffprobe.exe   # Windows
  FFPROBE_PATH=/usr/bin/ffprobe         # Linux (e.g. apt install ffmpeg)
  ```
- **Custom cache directory (auto-download only):** When you are _not_ setting `FFPROBE_PATH`, you can set `FFPROBE_AUTO_DIR` so the auto-downloaded binary is stored there instead of `<project>/.ffprobe`.

**Docker:** See [ffprobe in Docker](#ffprobe-in-docker) below.

### Environment Variables

| Variable               | Description                                                                                    | Default                 | Required |
| ---------------------- | ---------------------------------------------------------------------------------------------- | ----------------------- | -------- |
| `BACKEND_URL`          | URL of the backend API server                                                                  | `http://localhost:3001` | No       |
| `BACKEND_DISABLED`     | Disable backend usage (set to `true`/`false`)                                                  | `false`                 | No       |
| `SEARCH_PAGE_DISABLED` | Hide the search page and top-nav link (`true`/`1`/`yes`)                                       | `false`                 | No       |
| `FFPROBE_PATH`         | Path to ffprobe binary (frontend only). When set and valid, used as-is; cache dir is not used. | —                       | No       |
| `FFPROBE_AUTO_DIR`     | Directory for auto-downloaded ffprobe (frontend only, used only if `FFPROBE_PATH` is not set). | `<project>/.ffprobe`    | No       |
| `BACKEND_SERVICE_SECRET` | Optional; must match backend when set (see [Backend authentication](#backend-authentication--network-layout)) | unset | No       |

### Backend

1. Clone the repository:

```bash
git clone https://github.com/jittarao/torbox-app.git
cd torbox-app/backend
```

2. Install dependencies:

```bash
bun install
```

3. Generate an encryption key:

```bash
# Windows PowerShell:
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

# macOS/Linux:
openssl rand -base64 32
```

4. Create a `.env` file in the `backend` directory with the following variables:

```bash
FRONTEND_URL=http://localhost:3000
ENCRYPTION_KEY=your_secure_encryption_key_here_minimum_32_characters
```

**Important**: Replace `your_secure_encryption_key_here_minimum_32_characters` with the key generated in step 3.

5. Start the server:

```bash
bun start
```

6. For development with auto-reload:

```bash
bun run dev
```

### Environment Variables

| Variable               | Description                                                                      | Default                  | Required |
| ---------------------- | -------------------------------------------------------------------------------- | ------------------------ | -------- |
| `FRONTEND_URL`         | Frontend URL for CORS                                                            | `http://localhost:3000`  | Yes      |
| `ENCRYPTION_KEY`       | Base64-encoded key for API key encryption                                        | -                        | Yes      |
| `PORT`                 | Port for backend server                                                          | `3001`                   | No       |
| `NODE_ENV`             | Node environment                                                                 | `production`             | No       |
| `TORBOX_API_BASE`      | TorBox API base URL                                                              | `https://api.torbox.app` | No       |
| `TORBOX_API_VERSION`   | TorBox API version                                                               | `v1`                     | No       |
| `MASTER_DB_PATH`       | Directory for master database                                                    | `/app/data/master.db`    | No       |
| `USER_DB_DIR`          | Directory for user database files                                                | `/app/data/users`        | No       |
| `MAX_DB_CONNECTIONS`   | Maximum pooled database connections                                              | `200`                    | No       |
| `SQLITE_CACHE_SIZE_KB` | Per-connection SQLite page cache in KB (negative = KB; e.g. `-1000` = 1MB)       | `-1000`                  | No       |
| `IP_RATE_LIMIT_MAX`    | Max API requests per public IP per 15 minutes (private/Docker proxy IPs skipped) | `1000`                   | No       |
| `USER_RATE_LIMIT_MAX`  | Max API requests per authenticated user per 15 minutes                           | `500`                    | No       |
| `TRUST_PROXY`          | Trust `X-Forwarded-For` when behind a reverse proxy (`true` to enable)           | unset                    | No       |
| `BACKEND_REQUIRE_API_KEY` | Require `x-api-key` on all user routes (disables legacy `authId`-only access) | unset (`false`)          | No       |
| `BACKEND_SERVICE_SECRET` | Shared secret for Next.js → backend internal routes (≥16 chars; set on FE + BE) | unset                    | No       |

Set the same `BACKEND_SERVICE_SECRET` on the **frontend** (`.env.local` / compose `torbox-app` service) when you use it on the backend.

## Backend authentication & network layout

This section describes the **recommended self-hosted topology** and when optional hardening env vars matter.

### Recommended production topology

```
Internet
   │
   ▼
Caddy (443) ──reverse_proxy──► 127.0.0.1:3000  (torbox-app / Next.js)
                                   │
                                   │  Docker network: http://torbox-backend:3001
                                   ▼
                              127.0.0.1:3001  (torbox-backend — not in Caddy)
```

Example Caddyfile (only the frontend is public):

```
yourdomain.com {
    reverse_proxy localhost:3000
}
```

Docker port bindings should keep the backend off the public interface:

```yaml
ports:
  - "127.0.0.1:3000:3000"   # frontend
  - "127.0.0.1:3001:3001"   # backend — localhost on host only
```

The frontend container uses `BACKEND_URL=http://torbox-backend:3001` (service name on the Docker network), not `localhost:3001`.

### What each credential is for

| Credential | Role |
| ---------- | ---- |
| **TorBox API key** | Real secret; required by Next.js API routes for users. |
| **`authId`** | `SHA-256(apiKey)` — user id for backend SQLite; added by many Next.js proxies server-side. Not a substitute for the API key when the backend is locked down. |
| **`BACKEND_SERVICE_SECRET`** | Optional; proves the caller is *your* Next.js app on internal routes (API key registration), not end users. |
| **`ENCRYPTION_KEY`** | Required; encrypts stored TorBox API keys in the master DB. |

### Do you need `BACKEND_REQUIRE_API_KEY` or `BACKEND_SERVICE_SECRET`?

| Your setup | `BACKEND_REQUIRE_API_KEY` | `BACKEND_SERVICE_SECRET` |
| -------- | ------------------------- | ------------------------ |
| Caddy → `:3000` only, backend `127.0.0.1:3001` or Docker-internal | **Not required** (default) | **Not required** (default) |
| Backend published as `0.0.0.0:3001` or reachable from the internet | **Recommended** (`true`) | Consider setting |
| Untrusted containers on the same Docker network as `torbox-backend` | Consider `true` | **Recommended** |

With the recommended layout, internet users never talk to port `3001`. They use Next.js, which **requires `x-api-key`** on user-facing `/api/*` routes and forwards it to the backend. Legacy `authId`-only mode on the backend only matters if something can call the backend **directly** without the TorBox API key (host access, mis-published port, compromised container on `torbox-network`). The `authId` query param on some server-side proxies is extra metadata, not a substitute for the key.

The backend may log a startup warning about legacy auth; that is **informational** for this layout, not a requirement to change config.

### Generating `BACKEND_SERVICE_SECRET` (optional)

```bash
openssl rand -base64 32
```

Set the **same** value on both services, e.g. in compose:

```yaml
# torbox-app
environment:
  BACKEND_SERVICE_SECRET: your_secret_here

# torbox-backend
environment:
  BACKEND_SERVICE_SECRET: your_secret_here
```

## Full Stack Deployment (Frontend + Backend)

### Docker Compose (Recommended)

This deployment method uses the provided `docker-compose.yml` file to run both frontend and backend services together with automatic health checks, service dependencies, and persistent data storage.

**Note**: This method uses pre-built Docker images from GitHub Container Registry (`ghcr.io/jittarao/torbox-app:latest` and `ghcr.io/jittarao/torbox-app:backend-latest`). No building is required - Docker will automatically pull the images when you start the services.

#### Prerequisites

- Docker and Docker Compose installed

#### Deployment Steps

1. Get the `docker-compose.yml` file (clone repository or download it):

```bash
git clone https://github.com/jittarao/torbox-app.git
cd torbox-app
```

**Alternative**: If you only need the `docker-compose.yml` file, you can download it directly from the repository without cloning the entire project.

2. Generate an encryption key (required for API key encryption):

```bash
# Windows PowerShell:
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

# macOS/Linux:
openssl rand -base64 32
```

3. Create a `.env` file in the root directory with the following variables:

```bash
# Backend (torbox-backend) — read by docker-compose.yml
FRONTEND_URL=http://localhost:3000
ENCRYPTION_KEY=your_secure_encryption_key_here_minimum_32_characters

# Optional: same value on frontend + backend (see Backend authentication section)
# BACKEND_SERVICE_SECRET=your_secure_service_secret_here_minimum_16_characters

# Optional: error reporting (set SENTRY_ENABLED=false to disable)
# SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx

# Optional: ffprobe for audiobook chapter extraction (frontend container)
# FFPROBE_AUTO_DIR=/tmp/.ffprobe
# FFPROBE_PATH=/usr/bin/ffprobe
```

**Important**:

- Replace `your_secure_encryption_key_here_minimum_32_characters` with the key generated in step 2
- The encryption key must be at least 32 characters long and should be base64-encoded
- **`FRONTEND_URL` is required for production** — set it to the public origin users use in the browser (scheme + host, no trailing slash), e.g. `https://yourdomain.com`. For local Compose testing, `http://localhost:3000` is fine. Wrong values cause CORS errors.
- `docker-compose.yml` reads backend variables from the root `.env` file. Frontend vars (`BACKEND_URL`, `BACKEND_DISABLED`) are set in the compose file (`http://torbox-backend:3001` on the Docker network).
- Never commit `.env` to git
- For audiobook chapter extraction, add `FFPROBE_AUTO_DIR` or `FFPROBE_PATH` to the frontend service in `docker-compose.yml` (see [ffprobe in Docker](#ffprobe-in-docker))

4. Start both services (Docker will automatically pull the pre-built images):

```bash
docker compose up -d
```

5. Verify services are running:

```bash
docker compose ps
```

6. Check logs if needed:

```bash
# All services
docker compose logs

# Frontend only
docker compose logs torbox-app

# Backend only
docker compose logs torbox-backend
```

7. Open [http://localhost:3000](http://localhost:3000) and enter your TorBox API key!
   - User databases are automatically created when you enter an API key

#### How It Works

The `docker-compose.yml` configuration provides:

- **Pre-built Images**: Uses official images from GitHub Container Registry:
  - Frontend: `ghcr.io/jittarao/torbox-app:latest`
  - Backend: `ghcr.io/jittarao/torbox-app:backend-latest`

- **Service Communication**: Services communicate via Docker's internal network (`torbox-network`). The frontend connects to the backend using the service name `http://torbox-backend:3001`.

- **Health Checks**:
  - Backend health check: `/health` endpoint
  - Frontend health check: HTTP response check
  - Frontend waits for backend to be healthy before starting

- **Persistent Storage**:
  - Backend data is stored in a Docker volume (`backend-data`)
  - Includes user databases, automation rules, and application data
  - Data persists across container restarts

- **Automatic Restarts**: Both services are configured with `restart: unless-stopped`

- **Security**: Containers run with `no-new-privileges` security option. For production on a VPS, bind ports to `127.0.0.1` and put Caddy in front of port `3000` only — see [Backend authentication & network layout](#backend-authentication--network-layout).

#### Managing the Deployment

**Stop services:**

```bash
docker compose down
```

**Stop services and remove volumes (⚠️ deletes all data):**

```bash
docker compose down -v
```

**Update to latest images:**

```bash
docker compose pull
docker compose up -d
```

**View resource usage:**

```bash
docker stats
```

#### ffprobe in Docker

Chapter extraction runs in the **frontend** (Next.js) container. **Choose one:** use a pre-installed binary (`FFPROBE_PATH`) or let the app auto-download (`FFPROBE_AUTO_DIR`). You do not need both.

**Option A – Pre-installed ffprobe (simplest if you control the image)**  
Build a custom frontend image that includes FFmpeg:

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
```

Then set **only** `FFPROBE_PATH`; you do **not** need `FFPROBE_AUTO_DIR`:

```bash
FFPROBE_PATH=/usr/bin/ffprobe
```

**Option B – Auto-download (pre-built image)**  
Do **not** set `FFPROBE_PATH`. Set `FFPROBE_AUTO_DIR` to a writable path. The app will download ffprobe into **that directory** (not project root) on first use. The pre-built image is glibc-based; ensure the container has outbound HTTPS.

- **Ephemeral:** `FFPROBE_AUTO_DIR=/tmp/.ffprobe` works, but the binary lives inside the container and is lost on restart, so the app will re-download on next use. No error, just extra download after each restart.
- **Persistent:** Use a volume so the cache dir is outside the container filesystem; the binary then survives restarts and is not re-downloaded. Example for `docker run`:
  ```bash
  -e FFPROBE_AUTO_DIR=/app/.ffprobe -v torbox-ffprobe-cache:/app/.ffprobe
  ```
  For Docker Compose, add to the **frontend** service (`torbox-app`):
  ```yaml
  environment:
    - FFPROBE_AUTO_DIR=/app/.ffprobe
  volumes:
    - ffprobe-cache:/app/.ffprobe
  ```
  and add `ffprobe-cache:` under `volumes:`.

**Alpine-based images:** The auto-downloaded binary is glibc-based and will not run on Alpine (musl). Either use a glibc-based image (Option B) or install ffprobe in the image (`apk add ffmpeg`) and use Option A with `FFPROBE_PATH=/usr/bin/ffprobe`.

**Read-only filesystem:** Set either `FFPROBE_PATH` to a binary in a writable location or `FFPROBE_AUTO_DIR` to a writable path (e.g. a mounted volume).

#### Custom Volume Location

To use a custom host directory for backend data instead of a Docker volume, uncomment and modify the `driver_opts` section in `docker-compose.yml`:

```yaml
volumes:
  backend-data:
    driver_opts:
      type: none
      device: /path/to/backend/data
      o: bind
```

Replace `/path/to/backend/data` with your desired directory path.

### Portainer

Use the repo’s [`portainer.yml`](portainer.yml) as a stack template. It is **safe to commit** — secrets are set only in Portainer (Stack → Environment variables), not in the YAML.

#### Prerequisites

- Docker and Portainer installed
- External volume and network (once per host):

```bash
docker volume create torbox-backend-data
docker network create torbox-network
```

#### Required stack environment variables

| Variable | Description |
| -------- | ----------- |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` — do not change after data exists |
| `FRONTEND_URL` | Public browser origin for CORS, e.g. `https://yourdomain.com` (no trailing slash) |

#### Optional stack environment variables

| Variable | Description |
| -------- | ----------- |
| `SENTRY_DSN` | Sentry DSN; omit to disable (stack defaults `SENTRY_ENABLED=true` when set) |
| `BACKEND_SERVICE_SECRET` | Same value on both services; optional hardening |
| `SEARCH_PAGE_DISABLED` | `true` to hide the search page |

#### Deploy

1. In Portainer: **Stacks** → **Add stack** (or edit existing).
2. Paste `portainer.yml` or point the stack at this repository file.
3. Set the required env vars above.
4. Deploy / **Update the stack** — `pull_policy: always` pulls fresh images from GHCR on each update.

#### Portainer notes

- Ports bind to **`127.0.0.1`** only — put Caddy/nginx/Traefik on the host in front of `:3000`; do not expose `:3001` publicly.
- Mount **only** `/app/data` for persistence — never mount over `/app/src` or `/app/config`.
- Frontend health uses **Node** + `/api/health` (see [Troubleshooting](#troubleshooting)).

## Production Deployment (Self-Hosting with Docker + Caddy)

This guide sets up a production-ready deployment on a VPS with:

- Dockerized frontend and backend
- Caddy as reverse proxy with automatic HTTPS
- Basic server hardening
- Auto-updates via Watchtower

### Prerequisites

- A VPS (e.g., Hetzner, DigitalOcean, Linode)
- A domain name pointing to your server's IP
- SSH access to your server

### 1. Base Server Setup

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw fail2ban docker.io docker-compose htop
sudo systemctl enable docker
sudo systemctl start docker
```

### 2. Create a Non-Root User

```bash
sudo adduser username
sudo usermod -aG sudo username
sudo usermod -aG docker username
```

Log out and back in so group changes apply.

### 3. Lock Down SSH

```bash
sudo nano /etc/ssh/sshd_config
```

Recommended minimal changes:

```
PermitRootLogin no
PasswordAuthentication no
```

**Important**: Ensure you have SSH keys set up before disabling password authentication.

Then:

```bash
sudo systemctl restart ssh
```

### 4. Firewall Setup

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

### 5. Enable Fail2ban

```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 6. Generate Encryption Key

Generate a secure encryption key for the backend:

```bash
# Generate base64-encoded key
openssl rand -base64 32
```

Save this key securely - you'll need it in the next step.

### 7. Create Docker Network

Create a Docker network so the containers can communicate with each other:

```bash
docker network create torbox-network
```

### 8. Run Backend Service

Run the backend on port 3001 (internal, not exposed to internet):

```bash
docker run -d \
  --name torbox-backend \
  --restart=always \
  --network torbox-network \
  -p 127.0.0.1:3001:3001 \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  -e FRONTEND_URL=https://yourdomain.com \
  -e ENCRYPTION_KEY=your_secure_encryption_key_here_minimum_32_characters \
  -e NODE_ENV=production \
  -e PORT=3001 \
  -v torbox-backend-data:/app/data \
  ghcr.io/jittarao/torbox-app:backend-latest
```

**Note**: The `--log-driver` and `--log-opt` flags configure log rotation (10MB max per file, 3 files max) to prevent disk space issues. These are optional but recommended for production.

**Important**:

- Replace `your_secure_encryption_key_here_minimum_32_characters` with the key generated in step 6
- Replace `yourdomain.com` with your actual domain name
- The `-p 127.0.0.1:3001:3001` binding ensures the backend is only accessible from localhost

Test the backend:

```bash
curl http://localhost:3001/health
```

### 9. Run Frontend Service

Run the frontend on port 3000 (internal, Caddy will expose 80/443):

```bash
docker run -d \
  --name torbox-app \
  --restart=always \
  --network torbox-network \
  -p 127.0.0.1:3000:3000 \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  -e BACKEND_URL=http://torbox-backend:3001 \
  -e BACKEND_DISABLED=false \
  -e NODE_ENV=production \
  -e NEXT_TELEMETRY_DISABLED=1 \
  -e FFPROBE_AUTO_DIR=/tmp/.ffprobe \
  ghcr.io/jittarao/torbox-app:latest
```

**Important**:

- The `BACKEND_URL` is set to `http://torbox-backend:3001` (using the container name) because containers communicate via Docker network using container names.
- Both containers must be on the same Docker network (`torbox-network`).
- **Audiobook chapters:** Either set **`FFPROBE_PATH`** (if your image includes FFmpeg—the pre-built image does not) and then you do not need a cache dir, or set **`FFPROBE_AUTO_DIR`** so the app auto-downloads ffprobe into that path on first use. With `/tmp/.ffprobe`, the binary is lost on container restart and will be re-downloaded next time; for a persistent cache use a volume (see [ffprobe in Docker](#ffprobe-in-docker)). Omit both if you do not need chapter extraction.

**Note**: The `--log-driver` and `--log-opt` flags configure log rotation (10MB max per file, 3 files max) to prevent disk space issues. These are optional but recommended for production.

Test the frontend:

```bash
curl http://localhost:3000
```

### 10. Install and Configure Caddy

Install Caddy:

```bash
sudo apt install -y caddy
```

Edit the Caddyfile:

```bash
sudo nano /etc/caddy/Caddyfile
```

Example configuration:

```
yourdomain.com {
    reverse_proxy localhost:3000
}
```

Do **not** add a `reverse_proxy` for port `3001` — the backend should stay on localhost/Docker-internal only. See [Backend authentication & network layout](#backend-authentication--network-layout).

**Note**: Caddy will automatically obtain and renew SSL certificates via Let's Encrypt.

Reload Caddy:

```bash
sudo systemctl reload caddy
```

Check the status:

```bash
sudo systemctl status caddy
curl -I https://yourdomain.com
```

### 11. Auto-Update Containers (Watchtower)

Set up Watchtower to automatically update your containers:

```bash
docker run -d \
  --name watchtower \
  --restart=always \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  nickfedor/watchtower \
  --cleanup \
  --interval 3600
```

This will check for updates every hour and automatically pull and restart containers with new images.

**Note**: The `--log-driver` and `--log-opt` flags configure log rotation (10MB max per file, 3 files max) to prevent disk space issues. These are optional but recommended for production.

### 12. Verify Deployment

1. Visit `https://yourdomain.com` in your browser
2. Enter your TorBox API key when prompted
3. User databases are automatically created when you enter an API key

### Alternative: Using Docker Compose

If you prefer using Docker Compose for production instead of individual `docker run` commands, follow the [Full Stack Deployment](#full-stack-deployment-frontend--backend) section above, but make these production-specific modifications:

1. In your `.env` file, use your production domain and secrets:

```bash
FRONTEND_URL=https://yourdomain.com
ENCRYPTION_KEY=your_secure_encryption_key_here_minimum_32_characters
```

2. Modify `docker-compose.yml` to bind ports to localhost only (for security):

```yaml
ports:
  - '127.0.0.1:3000:3000' # Frontend
  - '127.0.0.1:3001:3001' # Backend
```

3. Keep `BACKEND_URL=http://torbox-backend:3001` for the frontend service—the frontend runs inside a container and must reach the backend via the Docker service name, not localhost.

4. Point Caddy (or your reverse proxy) at **only** `localhost:3000` — do not proxy port `3001`. See [Backend authentication & network layout](#backend-authentication--network-layout).

5. `BACKEND_REQUIRE_API_KEY` and `BACKEND_SERVICE_SECRET` are optional for this layout; see the table in that section.

6. Follow steps 4-7 from the [Full Stack Deployment](#full-stack-deployment-frontend--backend) section to start and verify services.

### Managing the Production Deployment

**View running containers:**

```bash
docker ps
```

**View logs:**

```bash
# Frontend
docker logs torbox-app

# Backend
docker logs torbox-backend

# Follow logs
docker logs -f torbox-app
```

**Restart services:**

```bash
docker restart torbox-app torbox-backend
```

**Manually update to latest images:**

```bash
docker pull ghcr.io/jittarao/torbox-app:latest
docker pull ghcr.io/jittarao/torbox-app:backend-latest
docker restart torbox-app torbox-backend
```

**Backup backend data:**

```bash
docker run --rm \
  -v torbox-backend-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/torbox-backend-backup-$(date +%Y%m%d).tar.gz /data
```

**Restore backend data:**

```bash
docker run --rm \
  -v torbox-backend-data:/data \
  -v $(pwd):/backup \
  alpine sh -c "cd /data && tar xzf /backup/torbox-backend-backup-YYYYMMDD.tar.gz"
```

### Security Notes

- **Public surface** — Only the reverse proxy (e.g. Caddy on 443) should reach the app; proxy to `localhost:3000` only. Do not expose `:3001` in Caddy or bind the backend to `0.0.0.0` on the host unless you also set `BACKEND_REQUIRE_API_KEY=true`.
- **Docker** — Use `127.0.0.1:3000:3000` and `127.0.0.1:3001:3001` so neither service is reachable from the host's public IP on those ports.
- **Optional env vars** — `BACKEND_REQUIRE_API_KEY` and `BACKEND_SERVICE_SECRET` are not required for the usual Caddy + localhost Docker setup; see [Backend authentication & network layout](#backend-authentication--network-layout).
- **`authId` in logs** — Avoid logging full backend URLs with `?authId=` query strings on shared log aggregators.
- **`ENCRYPTION_KEY`** — Keep secure and backed up; losing it means losing access to encrypted API keys stored in the master database.
- **Updates** — Regularly update containers and system packages; monitor logs for suspicious activity.

## Requirements

- **Docker Deployment**:
  - Docker and Docker Compose

- **Local Development**:
  - Node.js 18.0 or later (or Bun)
