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

GO VIRUS has four scanner modes.

### Development mode

```env
SCAN_PROVIDER=development
```

Used by CI and normal development when no antivirus service is required. It returns an `UNKNOWN` placeholder result and never claims to be a real antivirus verdict.

### Local ClamAV mode

```env
SCAN_PROVIDER=clamav
CLAMAV_HOST=clamav
CLAMAV_PORT=3310
```

Start the official ClamAV container with:

```bash
docker compose --profile real-scan up --build
```

Files are streamed from the backend to `clamd` with the ClamAV `INSTREAM` protocol. The ClamAV TCP port is only exposed inside the Docker network; it is not published to the host.

ClamAV supports both PUBLIC and PRIVATE submissions because scanning stays inside the GO VIRUS Docker environment.

### VirusTotal-only mode

```env
SCAN_PROVIDER=virustotal
VIRUSTOTAL_API_KEY=your_key_here
```

This uses VirusTotal API v3 for public multi-engine scanning. PRIVATE submissions are rejected in this mode because the standard VirusTotal API is treated as a public external scanner.

### Real combined mode

Recommended for normal GO VIRUS operation:

```env
SCAN_PROVIDER=real
CLAMAV_HOST=clamav
CLAMAV_PORT=3310
VIRUSTOTAL_API_KEY=your_key_here
```

Start it with:

```bash
docker compose --profile real-scan up --build
```

Behavior:

- PUBLIC file: local ClamAV scan first, then VirusTotal when an API key is configured.
- PRIVATE file: local ClamAV only. The file and its hash are not sent to VirusTotal.
- If VirusTotal returns a pending analysis, the local ClamAV result is saved immediately while the scan remains `RUNNING`.
- When VirusTotal completes, its per-engine results are added to the same scan without deleting the local ClamAV result.
- The final overall verdict is calculated from all stored engine results.
- Uploaded binaries are deleted after the configured scanning handoff finishes; metadata and scan results remain.

VirusTotal is optional in `real` mode. Without `VIRUSTOTAL_API_KEY`, GO VIRUS still performs a real local ClamAV scan.

### Real ClamAV integration test

The repository includes an isolated test that uses separate Docker ports and volumes:

```bash
bash scripts/test-real-scanner.sh
```

It starts the `real-scan` profile, verifies ClamAV readiness, scans a clean private file, and then checks detection using the harmless EICAR antivirus test file.

### File validation

Validation is enforced in both React and NestJS:

- non-empty file;
- maximum 25 MB by default;
- filename maximum 255 characters;
- backend filename normalization;
- SHA-256, SHA-1 and MD5 calculated server-side.

### Manual rescan

GO VIRUS does not retain uploaded binaries after scanning. Therefore:

- VirusTotal can request a hash-based re-analysis for a known PUBLIC file.
- A fresh local ClamAV rescan requires the original binary to be uploaded again.
- PRIVATE files must be re-uploaded if the user wants a new local ClamAV analysis.
