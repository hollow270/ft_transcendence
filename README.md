*This project has been created as part of the 42 curriculum by [login 1], [login 2], [login 3], [login 4].*

# GO VIRUS / ft_transcendence

## Description

GO VIRUS is a web application for checking whether a file or a link is dangerous. A visitor uploads a file or pastes a URL, the platform scans it with several antivirus engines and shows one clear verdict together with the result of every engine. A signed-in user can keep a private history, discuss results with the community, ask an AI assistant to explain a report in plain language, and automate everything through a public API.

Main goals:

- give people a fast, understandable second opinion on a suspicious file or link;
- keep private scans private: private files are scanned locally with ClamAV and are never sent to an external service;
- turn scan results into shared knowledge through comments, votes, reports and moderation;
- show the whole thing as a secure, accessible and observable product (WAF, Vault, 2FA, audit trail, analytics).

Key features:

- file and URL scanning with ClamAV and VirusTotal, SHA-256 deduplication and a shared public result cache;
- guest scan on the landing page with a limited report, attached to the account after sign-up;
- community layer: nested comments, harmless/suspicious/malicious votes, comment votes, reports and a moderation queue;
- AI assistant that explains a scan and answers cybersecurity questions, streamed over Server-Sent Events;
- live notifications over WebSockets;
- public REST API with hashed API keys and per-key rate limits;
- administrator dashboard with platform analytics and user management;
- TOTP two-factor authentication, session management, account deletion;
- HTTPS-only access behind an OWASP CRS / ModSecurity WAF, secrets held in HashiCorp Vault.

## Instructions

Requirements: Docker with the Compose plugin, `git`, `curl`. Node.js is optional (it is only used for the accessibility audit).

```bash
git clone https://github.com/hollow270/ft_transcendence.git
cd ft_transcendence
cp .env.example .env
docker compose up --build
```

Open the application at:

```text
https://localhost:8443
```

The WAF generates a self-signed certificate when none is provided, so the browser shows a warning the first time. For a trusted local certificate run `bash scripts/setup-local-tls.sh` (needs `mkcert`). Plain HTTP is not published.

Optional keys in `.env`: `VIRUSTOTAL_API_KEY` (adds VirusTotal for public files) and `OPENAI_API_KEY` (enables the AI assistant). Everything else works with the defaults. Both keys, together with the 2FA and claim-token secrets, are moved into Vault at startup.

Local development (hot reload for the frontend):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Direct local ports, bound to the loopback interface only:

```text
127.0.0.1:5173  frontend
127.0.0.1:3000  backend (GET /health)
127.0.0.1:5432  PostgreSQL
```

Validation:

```bash
bash scripts/smoke-test.sh
node scripts/accessibility-audit.mjs
```

`docker compose down -v` deletes the local database and Vault volumes. Use it only when you want a clean start.

## Resources

- NestJS: https://docs.nestjs.com
- Prisma: https://www.prisma.io/docs
- React: https://react.dev, Vite: https://vite.dev, Tailwind CSS: https://tailwindcss.com/docs
- Socket.IO: https://socket.io/docs/v4
- OWASP Core Rule Set: https://coreruleset.org, ModSecurity: https://github.com/owasp-modsecurity/ModSecurity
- HashiCorp Vault (KV v2, AppRole): https://developer.hashicorp.com/vault/docs
- ClamAV: https://docs.clamav.net, VirusTotal API v3: https://docs.virustotal.com
- OpenAI API: https://platform.openai.com/docs
- WCAG 2.1: https://www.w3.org/TR/WCAG21/
- RFC 6238 (TOTP): https://datatracker.ietf.org/doc/html/rfc6238

How AI was used: an AI coding assistant helped with code review, refactoring, writing tests and drafting documentation. Every generated change was read, run and validated by the team before being kept, and the team can explain all of the code. The product itself uses an LLM as a feature (scan explanations and the cybersecurity assistant); that integration is described in the AI configuration section.

## Team Information

| Member | 42 login | Role |
|---|---|---|
| [name] | [login] | Product Owner, [other roles] |
| [name] | [login] | Project Manager / Scrum Master |
| [name] | [login] | Technical Lead, Developer |
| [name] | [login] | Developer |

Git author names found in the repository history: Khalil Amrene, Youssef HAJBI, hollow270, nizarfreeman.

## Project Management

- Work organisation: [how tasks were split and followed, for example weekly planning and short syncs].
- Tools: GitHub for the repository, branches and pull requests; Docker Compose for the shared environment; `scripts/smoke-test.sh` as the shared definition of done.
- Communication: [channel used by the team].

## Technical Stack

| Area | Technology | Why |
|---|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React Router | fast component UI with a small build; one design system for every page |
| Backend | NestJS 11, TypeScript | modular structure, guards, validation and WebSocket gateway in one framework |
| Database | PostgreSQL 16 with Prisma 6 | relational data (artifacts, scans, comments) with versioned migrations |
| Real time | Socket.IO | rooms per user and for admins, live notifications |
| Scanning | ClamAV, VirusTotal API v3 | local private scans plus multi-engine public scans |
| LLM | OpenAI-compatible API with SSE streaming | scan explanations and a cybersecurity assistant |
| Edge security | OWASP CRS + ModSecurity on nginx | blocking WAF, TLS 1.2/1.3, security headers, CSP |
| Secrets | HashiCorp Vault (KV v2, AppRole) | API keys and encryption keys never sit in the backend environment |
| Packaging | Docker Compose | one command starts the full stack |

## Database Schema

PostgreSQL, 20 tables, 5 migrations. Full column-level description: `backend/prisma/DATABASE.md`.

```text
users ──< user_sessions
users ──1 user_2fa
users ──< submissions >── artifacts ──1 file_artifacts | url_artifacts
artifacts ──< scans ──< scan_engine_results >── scan_engines
artifacts ──< comments ──< comment_votes, comment_reports, moderation_actions
artifacts ──< community_votes >── users
users ──< notifications, api_keys ──< api_request_logs
llm_usage_logs (anonymous), audit_logs
```

| Table | Purpose |
|---|---|
| `users`, `user_2fa`, `user_sessions` | accounts and roles, encrypted TOTP secret, 7-day sessions |
| `artifacts`, `file_artifacts`, `url_artifacts` | the real file (unique SHA-256) or URL (normalised) |
| `submissions` | who submitted an artifact, public or private, web or API |
| `scans`, `scan_engines`, `scan_engine_results` | each analysis and the verdict of every engine |
| `comments`, `comment_votes`, `community_votes` | discussion, comment votes and community verdict |
| `comment_reports`, `moderation_actions` | moderation workflow |
| `notifications` | scan, reply, vote, moderation and system events |
| `api_keys`, `api_request_logs` | hashed public API keys and usage |
| `llm_usage_logs` | anonymous LLM usage counters (no user reference since the last migration) |
| `audit_logs` | security and administration trail |

## Features List

| Feature | What it does | Main files |
|---|---|---|
| Scan a file | upload with real progress, preview and validation, ClamAV and VirusTotal, deduplicated by SHA-256 | `frontend/src/scanner.tsx`, `backend/src/artifacts` |
| Scan a URL | normalised URL submission and report | `frontend/src/pages/UrlPage.tsx` |
| History | own submissions, filters, delete a submission | `frontend/src/pages/HistoryPage.tsx` |
| Search | public artifacts by hash, name or domain with filters | `frontend/src/pages/SearchPage.tsx` |
| Community | comments, replies, votes, reports | `backend/src/community` |
| Moderation | report queue, hide or delete comments, ban | `backend/src/moderation` |
| AI assistant | scan explanation and cybersecurity questions over SSE | `backend/src/ai` |
| Notifications | stored and pushed live over Socket.IO | `backend/src/notifications` |
| Public API | `/api/v1` with API keys, see `docs/PUBLIC_API.md` | `backend/src/api-keys` |
| Account | profile, password, sessions, 2FA, deletion | `backend/src/account`, `backend/src/auth` |
| Administration | analytics dashboard, verdict distribution, user management | `frontend/src/pages/AdminPage.tsx` |
| Legal pages | privacy policy and terms of service | `frontend/src/pages/LegalPages.tsx` |

Account and admin routes:

| Method | Route | Purpose |
|---|---|---|
| GET | `/account/overview` | dashboard stats, 30-day activity, recent scans |
| PATCH | `/account/profile` | update username / email |
| POST | `/account/password` | change password |
| GET | `/account/sessions` | active sessions |
| DELETE | `/account/sessions/:id` | sign out one session |
| POST | `/account/sessions/revoke-others` | sign out all other sessions |
| POST | `/account/claims` | attach an anonymous scan to the account |
| POST | `/account/delete` | delete account |
| DELETE | `/artifacts/submissions/:id` | delete one of your own submissions |
| GET | `/admin/users` | paginated user list |
| PATCH | `/admin/users/:id` | change role / status |
| POST | `/admin/users/:id/revoke-sessions` | force sign-out |

## Modules

Twelve modules, 19 points (14 required).

| Module | Type | Points | Where and why |
|---|---|---:|---|
| Web framework (frontend and backend) | Major | 2 | React + Vite and NestJS |
| Real-time features with WebSockets | Major | 2 | Socket.IO gateway, live notifications for every account event |
| Public API | Major | 2 | `/api/v1`, hashed keys, per-key rate limit, 6 endpoints, `docs/PUBLIC_API.md` |
| LLM interface | Major | 2 | streamed explanations and assistant, rate limited, anonymous usage logs |
| WAF / ModSecurity and HashiCorp Vault | Major | 2 | OWASP CRS blocking WAF in front of everything, Vault for every secret |
| Advanced analytics dashboard | Major | 2 | admin dashboard: activity, verdict distribution, platform metrics |
| Accessibility (WCAG 2.1 AA) | Major | 2 | contrast-checked palette, skip link, landmarks, labels, live regions, page titles, focus management, keyboard support; `scripts/accessibility-audit.mjs` |
| ORM | Minor | 1 | Prisma with versioned migrations |
| Notification system | Minor | 1 | stored and live notifications on create, update and delete actions |
| Advanced search | Minor | 1 | filters, sorting and pagination over public artifacts |
| File upload and management | Minor | 1 | validation, progress, preview, deduplication, delete own submission |
| Two-factor authentication | Minor | 1 | TOTP with encrypted secrets and replay protection |

Per-module evidence is listed in `docs/FEATURE_AUDIT.md`.

## Individual Contributions

| Member | Contributions |
|---|---|
| [name] | [features, files and challenges handled] |
| [name] | [features, files and challenges handled] |
| [name] | [features, files and challenges handled] |
| [name] | [features, files and challenges handled] |

---

# Operations guide

## AI configuration

The AI module supports:

- authenticated general cybersecurity questions;
- authenticated explanations of completed scans;
- Server-Sent Events streaming;
- authorization checks before private scan evidence is exposed;
- prompt-injection-resistant scan evidence formatting;
- anonymous LLM usage metrics in `llm_usage_logs` (model, token counts, outcome; no user, prompt or answer is stored);
- a per-client rate limit on both AI routes.

Set the key only in your local `.env`. At startup it is moved into Vault (see Secrets with Vault) and the backend reads it from there:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini
```

`OPENAI_BASE_URL` is optional for a compatible gateway/provider.

`LLM_RATE_LIMIT_PER_MINUTE` (default `10`) limits `POST /ai/ask` and `POST /ai/scans/explain` per client. The frontend shows a friendly message when the limit is reached.

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

Put the generated value in your local `.env` (it is stored in Vault at startup; when left empty a key is generated automatically on the first start):

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

The Compose stack includes an OWASP Core Rule Set / ModSecurity reverse-proxy WAF. It is the only public entry point:

```text
https://localhost:8443
```

The WAF accepts TLS 1.2 and TLS 1.3 only. Plain HTTP is not published.

The WAF:

- runs in blocking mode with OWASP CRS;
- proxies the React application, API and Socket.IO traffic;
- permits the HTTP methods used by GO VIRUS;
- supports the configured 25 MB upload limit;
- applies security headers including a CSP without inline scripts (`script-src 'self'`), frame protection, MIME sniffing protection, referrer policy and a restrictive permissions policy.

The frontend is served as a production build. The NestJS application also applies Helmet headers, restricts CORS and WebSocket origins, trusts only the reverse-proxy hop, removes the Express disclosure header, and enforces a global request rate limit. Registration, login and the AI routes are limited more aggressively.

Default local limits:

```env
HTTP_RATE_LIMIT_PER_MINUTE=300
LLM_RATE_LIMIT_PER_MINUTE=10
APP_ALLOWED_ORIGINS=https://localhost:8443,https://127.0.0.1:8443,http://localhost:5173,http://127.0.0.1:5173
```

For a real deployment, set `APP_ALLOWED_ORIGINS` and `WAF_SERVER_NAME` to the deployment hostname.

### HTTPS / TLS certificates

If `waf/tls/server.crt` and `waf/tls/server.key` are absent, the WAF creates a self-signed local certificate.

For a browser-trusted local certificate on macOS:

```bash
brew install mkcert
bash scripts/setup-local-tls.sh
docker compose up --build -d
```

The generated certificate and private key live under `waf/tls/` and are ignored by Git. Both files must be readable by every user (`chmod 644`) because the WAF runs as a different user inside its container; otherwise the WAF ignores them, prints a warning in its logs and keeps the generated self-signed certificate.

For a real deployment, put the trusted PEM certificate chain and private key at `waf/tls/server.crt` and `waf/tls/server.key`, then set:

```env
APP_HTTPS_PORT=443
WAF_SERVER_NAME=scanner.example.com
APP_ALLOWED_ORIGINS=https://scanner.example.com
```

and recreate the stack with `docker compose up --build -d`. Certificate issuance and renewal remain external deployment responsibilities; private keys are never committed.

## Secrets with Vault

Four secrets are held by HashiCorp Vault: `VIRUSTOTAL_API_KEY`, `OPENAI_API_KEY`, `TWO_FACTOR_ENCRYPTION_KEY` and `CLAIM_TOKEN_SECRET`.

How it works:

1. The `vault` service runs a Vault server with file storage on the `vault_data` volume. It is reachable only on the internal Docker network (port 8200 is not published).
2. The `vault-init` service initialises Vault on the first start, unseals it (and again after every restart), enables the KV v2 engine at `secret/`, writes a read-only policy for `secret/data/go-virus/backend`, creates the `go-virus-backend` AppRole and writes its credentials to the `vault_approle` volume.
3. `vault-init` stores the four secrets from `.env` in Vault. An empty value keeps what Vault already has; the 2FA key and the claim-token secret are generated when missing.
4. At boot the backend logs in with its AppRole, reads the secret and loads the values into memory. It retries for about 20 seconds while Vault becomes ready and refuses to start if Vault cannot be read.

The backend container receives none of these four values as environment variables. The unseal key and root token are kept in the `vault_keys` volume, which only `vault-init` mounts. This setup targets local use and evaluation; a production deployment would use an auto-unseal mechanism and TLS inside the network.

The older `*_FILE` variables (`VIRUSTOTAL_API_KEY_FILE`, `OPENAI_API_KEY_FILE`, `TWO_FACTOR_ENCRYPTION_KEY_FILE`) are still understood by the backend for deployments that mount secrets as files.

## Prisma migration workflow

Database V1 is version-controlled under `backend/prisma/migrations/`, followed by four later migrations (comment votes, 2FA replay protection, comment-received notification, anonymous LLM usage logs):

```text
backend/prisma/migrations/20261022084251_database_v1/
backend/prisma/migrations/20261118120000_comment_votes/
backend/prisma/migrations/20261118200000_two_factor_last_used_step/
backend/prisma/migrations/20261118210000_comment_received_notification/
backend/prisma/migrations/20261120120000_anonymous_llm_usage/
```

Normal startup generates the Prisma client and runs:

```bash
npx prisma migrate deploy
```

before NestJS starts.

Existing local databases created by earlier GO VIRUS versions with `prisma db push` are baselined automatically when the complete 19-table Database V1 schema is detected. Data is not deleted.

Check migration status:

```bash
docker compose exec backend npx prisma migrate status
```

Validate the schema:

```bash
docker compose exec backend npx prisma validate
```

For future schema changes, create a new migration during development:

```bash
cd backend
npx prisma migrate dev --name describe_the_change
```

Commit both the updated `schema.prisma` and the generated migration directory. Do not use `prisma db push` for normal project evolution.

## Validation

Run the end-to-end smoke test:

```bash
bash scripts/smoke-test.sh
```

It covers: Docker startup, PostgreSQL, Prisma (5 migrations), backend health, the production frontend build and CSP, API proxying, OWASP CRS blocking (XSS, SQL injection, path traversal), security headers, HTTPS-only access, authentication, file upload, SHA-based deduplication, scan reuse, artifact lookup, AI route authorization and streaming, comments, voting, notifications, privacy rules, the legal pages, and Vault (initialised, unsealed, secrets stored, no secrets in the backend environment, port not published, re-unseal after restart).

The accessibility audit runs without Docker and is also called by the smoke test when Node.js is installed:

```bash
node scripts/accessibility-audit.mjs
```

It checks the colour contrast of the palette against WCAG 2.1 AA (4.5:1 for text) and the markup rules: language, skip link, one main landmark, labelled form controls, image alternatives, named dialogs, announced errors, page titles, focus moved on navigation, visible focus, reduced motion.

> `docker compose down -v` deletes the local PostgreSQL and Vault volumes. Use it only when you intentionally want a clean start.

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

This starts PostgreSQL, ClamAV, Vault, the NestJS backend, the React frontend and the WAF together.

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
- a well-formed file type (MIME) and no control characters in the filename, checked in the browser and again on the server; every file type is accepted on purpose, because a scanner must be able to receive executables and archives;
- backend filename normalization;
- SHA-256, SHA-1 and MD5 calculated server-side.

### Manual rescan

GO VIRUS does not retain uploaded binaries after scanning. Therefore:

- VirusTotal can request a hash-based re-analysis for a known PUBLIC file.
- A fresh local ClamAV rescan requires the original binary to be uploaded again.
- PRIVATE files must be re-uploaded if the user wants a new local ClamAV analysis.
