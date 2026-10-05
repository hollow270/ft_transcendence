# ft_transcendence Docker base

Shared development base for the ft_transcendence team.

## Current stack

- NestJS backend
- PostgreSQL 16
- Docker Compose

Prisma and the application database models will be added after this Docker base is validated by the team.

## First run

Clone the repository:

```bash
git clone https://github.com/kamrene2771/ft_transcendence_docker.git
cd ft_transcendence_docker
```

Create your local environment file:

```bash
cp .env.example .env
```

Start everything:

```bash
docker compose up --build
```

Then test:

- Backend: http://localhost:3000
- Health + PostgreSQL connection: http://localhost:3000/health

Expected health response:

```json
{
  "status": "ok",
  "database": "connected"
}
```

Check containers:

```bash
docker compose ps
```

Stop the stack:

```bash
docker compose down
```

## Useful commands

Backend logs:

```bash
docker compose logs -f backend
```

PostgreSQL logs:

```bash
docker compose logs -f postgres
```

Rebuild:

```bash
docker compose up --build
```

> Do not use `docker compose down -v` unless you intentionally want to delete the local PostgreSQL data volume.

## Environment

`.env` is local and must never be committed.

`.env.example` documents the environment variables required by the project.
