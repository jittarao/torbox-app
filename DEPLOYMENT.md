# Deployment Guide

This guide covers deployment instructions for both the frontend and backend components of TorBox Manager.

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

### Environment Variables

| Variable          | Description                                   | Default                  | Required |
|-------------------|-----------------------------------------------|--------------------------|----------|
| `BACKEND_URL`     | URL of the backend API server                 | `http://localhost:3001`  | No       |
| `BACKEND_DISABLED`| Disable backend usage (set to `true`/`false`) | `false`                  | No       |

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

| Variable            | Description                                      | Default                      | Required   |
|---------------------|--------------------------------------------------|------------------------------|------------|
| `FRONTEND_URL`      | Frontend URL for CORS                            | `http://localhost:3000`      | Yes        |
| `ENCRYPTION_KEY`    | Base64-encoded key for API key encryption        | -                            | Yes        |
| `PORT`              | Port for backend server                          | `3001`                       | No         |
| `NODE_ENV`          | Node environment                                 | `production`                 | No         |
| `TORBOX_API_BASE`   | TorBox API base URL                              | `https://api.torbox.app`     | No         |
| `TORBOX_API_VERSION`| TorBox API version                               | `v1`                         | No         |
| `MASTER_DB_PATH`    | Directory for master database                    | `/app/data/master.db`        | No         |
| `USER_DB_DIR`       | Directory for user database files                | `/app/data/users`            | No         |
| `MAX_DB_CONNECTIONS`| Maximum pooled database connections              | `200`                        | No         |

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
# Backend
FRONTEND_URL=http://localhost:3000
ENCRYPTION_KEY=your_secure_encryption_key_here_minimum_32_characters
```

**Important**: 
- Replace `your_secure_encryption_key_here_minimum_32_characters` with the key generated in step 2
- The encryption key must be at least 32 characters long and should be base64-encoded
- The frontend environment variables (`BACKEND_URL` and `BACKEND_DISABLED`) are set in `docker-compose.yml` and use the Docker service name for internal communication

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

- **Security**: Containers run with `no-new-privileges` security option

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

### 7. Run Backend Service

Run the backend on port 3001 (internal, not exposed to internet):

```bash
docker run -d \
  --name torbox-backend \
  --restart=always \
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

### 8. Run Frontend Service

Run the frontend on port 3000 (internal, Caddy will expose 80/443):

```bash
docker run -d \
  --name torbox-app \
  --restart=always \
  -p 127.0.0.1:3000:3000 \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  -e BACKEND_URL=http://localhost:3001 \
  -e BACKEND_DISABLED=false \
  -e NODE_ENV=production \
  -e NEXT_TELEMETRY_DISABLED=1 \
  ghcr.io/jittarao/torbox-app:latest
```

**Note**: The `--log-driver` and `--log-opt` flags configure log rotation (10MB max per file, 3 files max) to prevent disk space issues. These are optional but recommended for production.

Test the frontend:

```bash
curl http://localhost:3000
```

### 9. Install and Configure Caddy

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

### 10. Auto-Update Containers (Watchtower)

Set up Watchtower to automatically update your containers:

```bash
docker run -d \
  --name watchtower \
  --restart=always \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --cleanup \
  --interval 3600
```

This will check for updates every hour and automatically pull and restart containers with new images.

**Note**: The `--log-driver` and `--log-opt` flags configure log rotation (10MB max per file, 3 files max) to prevent disk space issues. These are optional but recommended for production.

### 11. Verify Deployment

1. Visit `https://yourdomain.com` in your browser
2. Enter your TorBox API key when prompted
3. User databases are automatically created when you enter an API key

### Alternative: Using Docker Compose

If you prefer using Docker Compose for production instead of individual `docker run` commands, follow the [Full Stack Deployment](#full-stack-deployment-frontend--backend) section above, but make these production-specific modifications:

1. In your `.env` file, use your production domain:

```bash
FRONTEND_URL=https://yourdomain.com
ENCRYPTION_KEY=your_secure_encryption_key_here_minimum_32_characters
```

2. Modify `docker-compose.yml` to bind ports to localhost only (for security):

```yaml
ports:
  - "127.0.0.1:3000:3000"  # Frontend
  - "127.0.0.1:3001:3001"  # Backend
```

3. Update frontend environment in `docker-compose.yml` to use localhost:

```yaml
environment:
  - BACKEND_URL=http://localhost:3001
```

4. Follow steps 4-7 from the [Full Stack Deployment](#full-stack-deployment-frontend--backend) section to start and verify services.

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

- The backend is only accessible from localhost (127.0.0.1) - it should never be exposed directly to the internet
- The frontend is also bound to localhost and accessed through Caddy
- Keep your encryption key secure and backed up - losing it means losing access to encrypted API keys
- Regularly update your containers and system packages
- Monitor logs for any suspicious activity

## Requirements

- **Docker Deployment**:
  - Docker and Docker Compose

- **Local Development**:
  - Node.js 18.0 or later (or Bun)
