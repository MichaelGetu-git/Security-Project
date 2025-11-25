# Docker Setup Guide

## Quick Start

Run everything with Docker:

```bash
docker compose up -d --build
```

This will start:
- **Database** (PostgreSQL) on port `5432`
- **Backend API** on port `3000`
- **Frontend** (React + Nginx) on port `80`

## Access the Application

- **Frontend**: http://localhost
- **Backend API**: http://localhost:3000
- **Database**: localhost:5432

## Commands

### Start all services
```bash
docker compose up -d
```

### Stop all services
```bash
docker compose down
```

### View logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f app
docker compose logs -f client
docker compose logs -f db
```

### Rebuild after code changes
```bash
# Rebuild everything
docker compose up -d --build

# Rebuild specific service
docker compose up -d --build app
docker compose up -d --build client
```

### Stop and remove everything (including volumes)
```bash
docker compose down -v
```

## Services

### Database (`db`)
- PostgreSQL 15
- Port: 5432
- Data persisted in `postgres_data` volume

### Backend (`app`)
- Node.js Express API
- Port: 3000
- Builds from root `Dockerfile`

### Frontend (`client`)
- React + Vite
- Served by Nginx
- Port: 80
- Builds from `client/Dockerfile`
- Proxies `/api` requests to backend

## Development vs Production

### Development (Current Setup)
- Frontend: `npm run dev` (Vite dev server)
- Backend: Docker

### Production (Docker Setup)
- Everything runs in Docker
- Frontend is built and served as static files via Nginx
- All services communicate via Docker network

## Troubleshooting

### Port already in use
If port 80 or 3000 is already in use, you can change the ports in `docker-compose.yml`:
```yaml
client:
  ports:
    - "8080:80"  # Change 80 to 8080

app:
  ports:
    - "3001:3000"  # Change 3000 to 3001
```

### Frontend can't connect to backend
- Make sure both services are on the same network (`security_network`)
- Check that nginx config uses `app:3000` (service name, not localhost)

### Rebuild after dependency changes
```bash
# Rebuild with no cache
docker compose build --no-cache
docker compose up -d
```

