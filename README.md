# GO VIRUS / ft_transcendence

GO VIRUS is the current ft_transcendence application: a VirusTotal-inspired security scanner with community and AI-assisted scan explanations.

## Current stack

- React + Vite + Tailwind CSS frontend
- NestJS backend
- Prisma ORM
- PostgreSQL 16
- Socket.IO / WebSockets
- OpenAI-compatible streamed LLM integration
- Docker Compose

The database V1 contains 19 application tables for users, 2FA, sessions, file/URL artifacts, submissions, scans, scan engines/results, comments, votes, reports, moderation, notifications, API usage, LLM usage and audit logs.

Database details: `backend/prisma/DATABASE.md`

## First run

```bash
git clone https://github.com/kamrene2771/ft_transcendence_docker.git
cd ft_transcendence_docker
cp .env.example .env
docker compose up --build
```

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/health
```

Expected:

```json
{
  "status": "ok",
  "database": "connected"
}
```

## AI configuration

The AI module supports:

- authenticated general cybersecurity questions;
- authenticated explanations of completed scans;
- Server-Sent Events streaming;
- authorization checks before private scan evidence is exposed;
- prompt-injection-resistant scan evidence formatting;
- LLM usage metrics in `llm_usage_logs`;
- no storage of user prompts or generated answers.

Set the key only in your local `.env`:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini
```

`OPENAI_BASE_URL` is optional for a compatible gateway/provider.

Do **not** commit `.env`.

The frontend calls:

```text
POST /api/ai/ask
POST /api/ai/scans/explain
```

Vite proxies `/api/*` to the NestJS backend, where the routes are exposed as `/ai/*`.

## Prisma development workflow

The backend container currently runs:

```bash
npx prisma generate
npx prisma db push
npm run start:dev
```

Validate manually:

```bash
docker compose exec backend npx prisma validate
```

Verify tables:

```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\\dt"'
```

For now, `prisma db push` is used while the schema is still evolving. Once Database V1 is frozen, switch to versioned Prisma migrations.

## Automated smoke test

Run:

```bash
bash scripts/smoke-test.sh
```

The test covers Docker startup, PostgreSQL, Prisma, backend health, React build, API proxying, authentication, file upload, SHA-based deduplication, scan reuse, artifact lookup, AI route authorization/context streaming, comments, voting, notifications and privacy rules.

> `docker compose down -v` deletes the local PostgreSQL development volume. Use it only when you intentionally want a clean database.


## File scanning providers

GO VIRUS now has a pluggable file-scanning layer.

Local/CI default:

```env
SCAN_PROVIDER=development
```

This mode never pretends to be a real antivirus engine. It returns an UNKNOWN development result so the full application can be tested without external credentials.

Real public multi-engine scanning:

```env
SCAN_PROVIDER=virustotal
VIRUSTOTAL_API_KEY=your_key_here
```

The VirusTotal integration:

- checks an existing file report by SHA-256 before uploading;
- submits unknown public files to the v3 file scanning API;
- requests re-analysis by SHA-256 for manual rescans;
- stores each returned engine result separately in `scan_engine_results`;
- keeps the external provider analysis ID/status on the local `scans` row;
- supports refresh of pending analyses from the artifact report.

Important privacy rule: the standard VirusTotal API is treated as a **public scanner**. GO VIRUS will not send a PRIVATE submission (or its hash) to that provider. A privacy-preserving/private scanning provider must be configured before private external scanning can be enabled.

File validation is enforced in both the React UI and NestJS backend:

- non-empty file;
- maximum 25 MB;
- valid filename with a maximum of 255 characters;
- backend filename normalization;
- SHA-256/SHA-1/MD5 calculated server-side.

Manual rescan requires authentication and one of the user's own submissions for the artifact.
