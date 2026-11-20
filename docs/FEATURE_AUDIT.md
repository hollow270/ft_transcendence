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
| Notifications | PARTIAL | Scan-completion and moderation notifications with Socket.IO delivery | Reply notifications and generic create/update/delete coverage are incomplete |
| Public API | DONE | API-key auth, rate limiting, request logs, 6 endpoints using GET/POST/PUT/DELETE | — |
| Advanced public search | DONE | Query, type/verdict filters, sorting, pagination | — |
| Admin analytics | PARTIAL | Users, online count, submissions, scans, verdicts, API, comments, LLM, audit, 7/14/30-day activity, CSV | Votes metric, Today/custom dates, PDF export and real-time dashboard refresh still missing |
| WAF / secrets | PARTIAL | ModSecurity + OWASP CRS, TLS, security headers, file-mounted secrets | Real HashiCorp Vault integration is still missing |
| Database V1 | DONE | 19 tables with versioned Prisma migration | — |

## Selected ft_transcendence modules

| # | Module | Pts | Status | Notes |
|---:|---|---:|---|---|
| 1 | Framework for frontend + backend | 2 | DONE | React + NestJS |
| 2 | Real-time features using WebSockets | 2 | DONE | Authenticated Socket.IO user rooms and live notification delivery |
| 3 | Public API interacting with database | 2 | DONE | API keys, rate limiting, documentation, request logs, 6 endpoints including GET/POST/PUT/DELETE |
| 4 | ORM | 1 | DONE | Prisma + PostgreSQL |
| 5 | Complete notification system | 1 | PARTIAL | Not yet all create/update/delete actions |
| 6 | Advanced search | 1 | DONE | Filters, sorting and pagination implemented |
| 7 | File upload and management | 1 | PARTIAL | Validation/access control exist; file preview, upload progress and user-facing deletion management are incomplete |
| 8 | Complete LLM system interface | 2 | DONE | Text generation, SSE streaming, errors and global throttling |
| 9 | WAF/ModSecurity + HashiCorp Vault | 2 | PARTIAL | WAF is hardened; Vault itself is not integrated |
| 10 | Advanced analytics dashboard | 2 | PARTIAL | Dashboard/CSV exist; custom dates, PDF, richer interactive visualization and real-time updates remain |
| 11 | WCAG 2.1 AA accessibility | 2 | MISSING | Some keyboard/ARIA work exists, but complete WCAG 2.1 AA compliance has not been implemented or audited |
| 12 | Complete 2FA system | 1 | DONE | TOTP authenticator flow |

### Current safely claimable module points

Using only modules marked **DONE**:

- Framework frontend + backend: 2
- WebSockets: 2
- Public API: 2
- ORM: 1
- Advanced search: 1
- LLM system: 2
- 2FA: 1

**Safely claimable total: 11 points.**

The project target in the selected module plan is 14 points, so at least **3 additional points** should be closed before relying on this exact 19-point module selection.

## Best path to 14+ verified points

Highest-value remaining work:

1. **Advanced analytics dashboard (2 pts)** — add custom date ranges, Today/7/30 presets, PDF export and live refresh.
2. **Complete notification system (1 pt)** — emit notifications for relevant create/update/delete actions, especially comment replies and user-visible resource changes.

That reaches **14 safely claimable points** without depending on Vault or a full WCAG audit.

After that, file-management completion is another 1-point safety margin. Vault and WCAG are larger projects and should not be claimed until fully implemented.
