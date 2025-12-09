# anychat

Anonymous real-time chat application. No registration required - just visit and start chatting.

## Features

- 💬 Real-time messaging with WebSocket
- 🎨 Color-coded users (consistent across sessions)
- 🌍 Multi-language support (10 languages)
- 📱 Responsive design
- 🔒 Security hardened
- 🚀 Zero-downtime deployment

## Tech Stack

- **Runtime**: Bun
- **Backend**: Express + Socket.IO
- **Frontend**: Vanilla JavaScript
- **Deployment**: Docker + Koyeb

## Security Features

- XSS protection (HTML escaping)
- Rate limiting (10 messages per 10 seconds)
- Message length limit (5000 characters)
- Connection limit (100 concurrent users)
- CSP headers
- Non-root Docker user
- CORS configuration

## Local Development

### Prerequisites

- Bun 1.3.3+
- Docker (optional)

### Setup

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Access at http://localhost:3000
```

### Environment Variables

```bash
ALLOWED_ORIGINS=http://localhost:3000  # CORS allowed origins
STORAGE_TYPE=memory                     # Storage backend: 'memory' or 'redis'
REDIS_URL=redis://localhost:6379       # Redis connection URL (if using Redis)
```

## Docker

### Pull from GitHub Container Registry

```bash
docker pull ghcr.io/ymmmtym/anychat:main
docker run -p 3000:3000 ghcr.io/ymmmtym/anychat:main
```

### Build locally

```bash
docker build -t anychat .
```

### Run

```bash
# With memory storage (default)
docker run -p 3000:3000 anychat

# With Redis storage
docker run -p 3000:3000 \
  -e STORAGE_TYPE=redis \
  -e REDIS_URL=redis://redis:6379 \
  anychat
```

### Docker Compose with Redis

```bash
# Start services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down

# Stop and remove volumes
docker compose down -v
```

## Deployment

### GitHub Actions

Automatically builds and pushes Docker images to GitHub Container Registry:

**Branch builds:**
- Push to `main` → `ghcr.io/ymmmtym/anychat:main`

**Version releases:**
- Tag `v1.0.0` → `ghcr.io/ymmmtym/anychat:v1.0.0`, `v1.0`, `v1`, `1.0.0`, `1.0`, `1`, `latest`
- Tag `v1.2.3` → `ghcr.io/ymmmtym/anychat:v1.2.3`, `v1.2`, `v1`, `1.2.3`, `1.2`, `1`, `latest`

**Pull requests:**
- Build only (no push)

**Usage:**
```bash
# Latest stable release
docker pull ghcr.io/ymmmtym/anychat:latest

# Development version (main branch)
docker pull ghcr.io/ymmmtym/anychat:main

# Specific version (with v prefix)
docker pull ghcr.io/ymmmtym/anychat:v1.0.0

# Specific version (without v prefix)
docker pull ghcr.io/ymmmtym/anychat:1.0.0
```

### Koyeb

Automatically deploys to Koyeb on push to main branch.

#### Manual Deploy

1. Connect GitHub repository to Koyeb
2. Set build command: `docker build`
3. Set port: `3000`
4. Deploy

## API

### GET /stats

Returns server statistics:

```json
{
  "messages": 42,
  "storage": "memory",
  "memory": {
    "rss": "45.23 MB",
    "heapUsed": "12.34 MB",
    "heapTotal": "20.00 MB"
  }
}
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_MESSAGES` | 1000 | Maximum messages stored in memory |
| `MAX_MESSAGE_LENGTH` | 5000 | Maximum characters per message |
| `RATE_LIMIT_WINDOW` | 10000 | Rate limit window (ms) |
| `RATE_LIMIT_MAX` | 10 | Max messages per window |
| `MAX_CONNECTIONS` | 100 | Maximum concurrent connections |

## License

MIT
