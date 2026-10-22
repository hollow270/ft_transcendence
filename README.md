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

Secure application entry point:

```text
http://localhost:8080
```

Local development frontend:

```text
http://localhost:5173
```

Local development backend:

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

## One-command full stack

GO VIRUS now uses one Compose stack. There are no Docker Compose profiles for the normal application.

```bash
cp .env.example .env
docker compose up --build
```

That single command starts:

- PostgreSQL
- ClamAV
- NestJS backend
- React frontend

The default scanner mode in `.env.example` is `real`, so ClamAV is used automatically. VirusTotal is added for PUBLIC files when `VIRUSTOTAL_API_KEY` is configured.

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

## Two-factor authentication

GO VIRUS supports TOTP two-factor authentication with authenticator apps.

Generate a stable local encryption key once:

```bash
openssl rand -hex 32
```

Put the generated value in your local `.env`:

```env
TWO_FACTOR_ENCRYPTION_KEY=your_generated_value
```

Then restart the normal full stack:

```bash
docker compose down
docker compose up --build -d
```

Users can enable 2FA under **Settings → Security**. The setup secret is encrypted with AES-256-GCM before it is stored in PostgreSQL. Once 2FA is enabled, password login does not create a session until a valid 6-digit TOTP code is supplied.

Keep `TWO_FACTOR_ENCRYPTION_KEY` private and stable. Changing or losing it makes existing encrypted authenticator secrets unreadable.

## Security hardening

The normal Compose stack now includes an OWASP Core Rule Set / ModSecurity reverse-proxy WAF.

Use the secure entry point:

```text
http://localhost:8080
```

The direct development ports remain available only on the local loopback interface:

```text
127.0.0.1:5173  frontend
127.0.0.1:3000  backend
127.0.0.1:5432  PostgreSQL
```

This prevents the development services and database from listening on external host interfaces while keeping local debugging convenient.

The WAF:

- runs in blocking mode with OWASP CRS;
- proxies the React/Vite application, API and Socket.IO traffic;
- permits the HTTP methods used by GO VIRUS;
- supports the configured 25 MB upload limit;
- applies browser-facing security headers including CSP, frame protection, MIME sniffing protection, referrer policy and a restrictive permissions policy.

The NestJS application also applies Helmet security headers, restricts CORS and WebSocket origins, trusts only the reverse-proxy hop, removes the Express disclosure header, and enforces a global request rate limit. Registration and login are limited more aggressively.

Default local limits:

```env
HTTP_RATE_LIMIT_PER_MINUTE=300
APP_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080
```

For a real deployment, set `APP_ALLOWED_ORIGINS` and `WAF_SERVER_NAME` to the deployment hostname instead of keeping the local defaults.

### File-mounted secrets

GO VIRUS can read sensitive values either from normal environment variables or from files mounted into the backend container. This is useful with Docker secrets, Kubernetes secrets, or a Vault agent that writes secrets to files.

Supported file variables:

```env
VIRUSTOTAL_API_KEY_FILE=/run/secrets/virustotal
OPENAI_API_KEY_FILE=/run/secrets/openai
TWO_FACTOR_ENCRYPTION_KEY_FILE=/run/secrets/two_factor
```

When a `*_FILE` variable is configured, the file value takes precedence over the plain environment variable. Secret files are not included in the repository.

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

ClamAV is part of the normal Compose stack. No profile or separate command is required.

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

The whole application starts with one command:

```bash
docker compose up --build
```

This starts PostgreSQL, ClamAV, the NestJS backend, and the React frontend together.

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

It starts an isolated copy of the full Compose stack, verifies ClamAV readiness, scans a clean private file, and then checks detection using the harmless EICAR antivirus test file.

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
