# GO VIRUS Feature Audit

Status meanings:

- **DONE** — implemented and supported by the current application.
- **PARTIAL** — useful implementation exists, but one or more explicit requirements are still missing.
- **MISSING** — not complete enough to claim the requirement.

## GO VIRUS project brief

| Area | Status | Current implementation | Remaining gap |
|---|---|---|---|
| File and URL submission | DONE | Anonymous and authenticated file/URL submissions | — |
| SHA-256 / URL deduplication | DONE | File SHA-256 and normalized URL hash deduplication | — |
| Fresh scan reuse | DONE | Results up to 7 days can be reused; stale content starts a new analysis | — |
| Manual rescan | DONE | Artifact rescan endpoints and history | Local ClamAV file rescans require re-upload after binary deletion |
| Temporary file retention | DONE | Uploaded binary is not retained after scanner handoff; metadata/results remain | — |
| Public/private submissions | DONE | Public by default; private for authenticated users; private excluded from public search/API/community | — |
| Multi-engine results | DONE | Local ClamAV plus VirusTotal engine results stored separately | — |
| Overall verdict | DONE | Harmless / Suspicious / Malicious / Unknown precedence | — |
| Community comments/replies | DONE | Comments, nested parent relation, edit/delete, replies | — |
| Community verdict voting | DONE | One verdict per user/artifact, changeable | — |
| Comment reporting/moderation | DONE | Reports, moderator actions, audit trail, commenting bans | — |
| LLM explanations | DONE | Authenticated streamed explanations based on scan evidence; prompts/answers not stored; usage logs are anonymous; 10 requests per minute per client | — |
| Roles | DONE | USER / MODERATOR / ADMIN | — |
| 2FA | DONE | TOTP setup, verification, login challenge, disable flow | — |
| User history/community | DONE | Authenticated submission history and user community activity | — |
| Notifications | DONE | Persistent and real-time notifications cover scan completion, moderation, replies, votes, reports, sessions, API keys, 2FA, account status and submission deletion; every one is pushed live through one event path | — |
| Public API | DONE | API-key auth, rate limiting, request logs, 6 endpoints using GET/POST/PUT/DELETE | — |
| Advanced public search | DONE | Query, type/verdict filters, sorting, pagination | — |
| Admin analytics | DONE | Users, online count, submissions, scans, verdicts, comments/votes, API/LLM usage, interactive chart, Today/7/30/custom ranges, WebSocket live refresh and PDF/CSV export | — |
| WAF / secrets | DONE | ModSecurity + OWASP CRS in blocking mode, HTTPS-only entry, CSP without inline scripts, secrets read from HashiCorp Vault (AppRole, read-only policy) | — |
| Database | DONE | 20 tables (19 from Database V1 plus comment votes) with 5 versioned Prisma migrations | — |
| Privacy policy and terms | DONE | `/privacy` and `/terms`, linked from the landing page, the sign-up form and every signed-in page | — |

## Selected ft_transcendence modules

| # | Module | Pts | Status | Notes |
|---:|---|---:|---|---|
| 1 | Framework for frontend + backend | 2 | DONE | React + NestJS |
| 2 | Real-time features using WebSockets | 2 | DONE | Authenticated Socket.IO user rooms and live notification delivery |
| 3 | Public API interacting with database | 2 | DONE | API keys, rate limiting, documentation, request logs, 6 endpoints including GET/POST/PUT/DELETE |
| 4 | ORM | 1 | DONE | Prisma + PostgreSQL |
| 5 | Complete notification system | 1 | DONE | Persistent Socket.IO notifications cover scan/moderation/reply plus user-facing create/update/delete lifecycle events |
| 6 | Advanced search | 1 | DONE | Filters, sorting and pagination implemented |
| 7 | File upload and management | 1 | DONE | Client and server validation, real upload progress, image and text preview, remove before upload, delete own submission from History |
| 8 | Complete LLM system interface | 2 | DONE | Text generation, SSE streaming, errors and global throttling |
| 9 | WAF/ModSecurity + HashiCorp Vault | 2 | DONE | Blocking WAF with TLS 1.2/1.3; Vault server, init and unseal service, AppRole login from the backend, no secrets in the backend environment |
| 10 | Advanced analytics dashboard | 2 | DONE | Interactive multi-series chart, Today/7/30/custom ranges, live WebSocket refresh, vote metrics and PDF/CSV export |
| 11 | WCAG 2.1 AA accessibility | 2 | DONE | Contrast-checked palette, skip link, landmarks, labelled controls, announced errors, named dialog, no single-key shortcut, visible focus, reduced motion; verified by `scripts/accessibility-audit.mjs` |
| 12 | Complete 2FA system | 1 | DONE | TOTP authenticator flow |

### Claimable module points

| Module | Pts |
|---|---:|
| Framework frontend + backend | 2 |
| WebSockets | 2 |
| Public API | 2 |
| LLM system | 2 |
| WAF + Vault | 2 |
| Advanced analytics | 2 |
| WCAG 2.1 AA | 2 |
| ORM | 1 |
| Notifications | 1 |
| Advanced search | 1 |
| File upload and management | 1 |
| 2FA | 1 |

**Total: 19 points** (14 required, 5 points of margin).

## How each module is proven

| Module | Proof |
|---|---|
| Framework | `docker compose up` starts the React production build and the NestJS API; smoke test checks both |
| WebSockets | every stored notification is pushed to the user's Socket.IO room (event path covered by the in-memory proof suite); in the browser the bell badge updates without a reload |
| Public API | smoke test calls the `/api/v1` endpoints with a key (search, read, submit URL and file, rescan, delete) and checks that a revoked key gets 401 |
| LLM | smoke test checks SSE streaming, authorization and that the route answers 429 after too many requests |
| WAF + Vault | smoke test sends XSS, SQL injection and path traversal payloads (blocked), checks HTTPS-only access, Vault initialised and unsealed, secrets present in Vault, absent from the backend environment, port 8200 not published, unsealed again after a restart |
| Analytics | smoke test checks `/admin/overview`, activity ranges and the CSV export |
| WCAG 2.1 AA | `node scripts/accessibility-audit.mjs` (contrast ratios and markup rules, 34 checks) |
| ORM | smoke test expects exactly 5 applied Prisma migrations |
| Notifications | smoke test checks the stored create, update and delete notifications; the in-memory proof suite checks the live push |
| Advanced search | smoke test queries with type and verdict filters, sorting and pagination |
| File upload and management | smoke test uploads, deduplicates, deletes an own submission (history, notification, second delete rejected); progress and preview are visible in the browser |
| 2FA | smoke test enables TOTP and logs in with a generated code |

Checks that need a real browser (screen reader pass, axe or Lighthouse, upload progress and preview) are not covered by the automated scripts and should be done once by hand before the evaluation.
