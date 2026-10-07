# ft_transcendence Docker base

Shared development base for the ft_transcendence team.

## Current stack

- NestJS backend
- PostgreSQL 16
- Prisma ORM
- Docker Compose

The database V1 currently contains 19 application tables for users, files/URLs, submissions, scans, community features, moderation, API usage, LLM usage and audit logs.

Database details: `backend/prisma/DATABASE.md`

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

On startup, the backend automatically runs:

```bash
npx prisma generate
npx prisma db push
npm run start:dev
```

This creates/synchronizes the development database tables from `backend/prisma/schema.prisma`.

## Test

Backend:

```text
http://localhost:3000
```

Health + PostgreSQL connection:

```text
http://localhost:3000/health
```

Expected response:

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

Both `backend` and `postgres` should be healthy.

## Verify database tables

Run:

```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\\dt"'
```

You should see the application tables such as:

```text
users
user_2fa
user_sessions
artifacts
file_artifacts
url_artifacts
submissions
scans
scan_engines
scan_engine_results
comments
community_votes
comment_reports
moderation_actions
notifications
api_keys
api_request_logs
llm_usage_logs
audit_logs
```

## Prisma commands

Validate the schema:

```bash
docker compose exec backend npx prisma validate
```

Generate the client:

```bash
docker compose exec backend npx prisma generate
```

Synchronize the development database:

```bash
docker compose exec backend npx prisma db push
```

## Useful Docker commands

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

Stop:

```bash
docker compose down
```

> Do not use `docker compose down -v` unless you intentionally want to delete the local PostgreSQL data volume.

## Environment

`.env` is local and must never be committed.

`.env.example` documents the environment variables required by the project.

## Database workflow

For now we use `prisma db push` because the schema is still being designed.

Once Database V1 is frozen, we should switch to versioned Prisma migrations so every schema change is tracked in Git.
