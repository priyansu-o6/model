## Pratyaksha – Real-time Deepfake Detection Platform

Pratyaksha is a real-time deepfake detection platform for identity verification. This repository currently provides the full backend foundation, Dockerized services, and placeholders for the Next.js 14 frontend.

### Project Structure

- **frontend/**: Next.js 14 app (currently a placeholder with a Dockerfile).
- **backend/**: FastAPI service, Celery workers, PostgreSQL models, Alembic migrations.
- **docker-compose.yml**: Orchestrates frontend, backend, PostgreSQL, Redis, Milvus, MinIO, and n8n.
- **.env.example**: Example environment variables required to run the stack.

### Getting Started

1. **Copy and adjust env vars**

```bash
cp .env.example .env
```

2. **Run the stack with Docker Compose**

From the `pratyaksha` directory:

```bash
docker compose up --build
```

3. **Services**

- **API**: `http://localhost:8000` (FastAPI, health check at `/health`)
- **Frontend**: `http://localhost:3000` (placeholder)
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`
- **Milvus**: `localhost:19530`
- **MinIO**: `http://localhost:9000` (console at `http://localhost:9001`)
- **n8n**: `http://localhost:5678`

### Migrations

Inside the backend container (or with Python and dependencies installed locally from `backend/requirements.txt`):

```bash
alembic -c backend/alembic.ini upgrade head
```

