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
| LLM explanations | DONE | Authenticated streamed explanations based on scan evidence; prompts/answers not stored | — |
| Roles | DONE | USER / MODERATOR / ADMIN | — |
| 2FA | DONE | TOTP setup, verification, login challenge, disable flow | — |
| User history/community | DONE | Authenticated submission history and user community activity | — |
| Notifications | DONE | Persistent and real-time notifications cover scan completion, moderation, replies and user-facing resource create/update/delete lifecycles | — |
| Public API | DONE | API-key auth, rate limiting, request logs, 6 endpoints using GET/POST/PUT/DELETE | — |
| Advanced public search | DONE | Query, type/verdict filters, sorting, pagination | — |
| Admin analytics | DONE | Users, online count, submissions, scans, verdicts, comments/votes, API/LLM usage, interactive chart, Today/7/30/custom ranges, WebSocket live refresh and PDF/CSV export | — |
| WAF / secrets | PARTIAL | ModSecurity + OWASP CRS, TLS, security headers, file-mounted secrets | Real HashiCorp Vault integration is still missing |
| Database V1 | DONE | 19 tables with versioned Prisma migration | — |

## Selected ft_transcendence modules

| # | Module | Pts | Status | Notes |
|---:|---|---:|---|---|
| 1 | Framework for frontend + backend | 2 | DONE | React + NestJS |
| 2 | Real-time features using WebSockets | 2 | DONE | Authenticated Socket.IO user rooms and live notification delivery |
| 3 | Public API interacting with database | 2 | DONE | API keys, rate limiting, documentation, request logs, 6 endpoints including GET/POST/PUT/DELETE |
| 4 | ORM | 1 | DONE | Prisma + PostgreSQL |
| 5 | Complete notification system | 1 | DONE | Persistent Socket.IO notifications cover scan/moderation/reply plus user-facing create/update/delete lifecycle events |
| 6 | Advanced search | 1 | DONE | Filters, sorting and pagination implemented |
| 7 | File upload and management | 1 | PARTIAL | Validation/access control exist; file preview, upload progress and user-facing deletion management are incomplete |
| 8 | Complete LLM system interface | 2 | DONE | Text generation, SSE streaming, errors and global throttling |
| 9 | WAF/ModSecurity + HashiCorp Vault | 2 | PARTIAL | WAF is hardened; Vault itself is not integrated |
| 10 | Advanced analytics dashboard | 2 | DONE | Interactive multi-series chart, Today/7/30/custom ranges, live WebSocket refresh, vote metrics and PDF/CSV export |
| 11 | WCAG 2.1 AA accessibility | 2 | MISSING | Some keyboard/ARIA work exists, but complete WCAG 2.1 AA compliance has not been implemented or audited |
| 12 | Complete 2FA system | 1 | DONE | TOTP authenticator flow |

### Current safely claimable module points

Using only modules marked **DONE**:

- Framework frontend + backend: 2
- WebSockets: 2
- Public API: 2
- ORM: 1
- Complete notifications: 1
- Advanced search: 1
- LLM system: 2
- Advanced analytics: 2
- 2FA: 1

**Safely claimable total: 14 points.**

This reaches the project target in the selected module plan without depending on the modules that are still incomplete.

## Remaining safety-margin modules

The current unclaimed modules are:

1. **File upload and management (1 pt)** — preview, upload progress and user-facing deletion management still need completion.
2. **WAF/ModSecurity + HashiCorp Vault (2 pts)** — the WAF is implemented, but real HashiCorp Vault integration is still missing.
3. **WCAG 2.1 AA accessibility (2 pts)** — complete compliance still requires implementation and a dedicated accessibility audit.

These remaining modules are extra margin; they are not included in the verified 14-point total.
