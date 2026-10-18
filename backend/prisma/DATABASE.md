# Database V1

The database is modeled with Prisma and PostgreSQL.

The main idea is:

```text
Artifact = the real file or URL
Submission = somebody submitting that artifact
Scan = one analysis of that artifact
ScanEngineResult = one engine's result inside that scan
```

## Tables

| # | Table | Purpose |
|---:|---|---|
| 1 | `users` | Registered accounts, roles and account status |
| 2 | `user_2fa` | Two-factor authentication settings |
| 3 | `user_sessions` | Login sessions and online-user tracking |
| 4 | `artifacts` | Central object representing either a file or URL |
| 5 | `file_artifacts` | File hashes, size and MIME type |
| 6 | `url_artifacts` | Normalized URL, URL hash and domain |
| 7 | `submissions` | Every public/private submission by a user or anonymous visitor |
| 8 | `scans` | Each initial scan or rescan |
| 9 | `scan_engines` | External antivirus/security engines |
| 10 | `scan_engine_results` | Per-engine result for a scan |
| 11 | `comments` | Nested artifact discussions |
| 12 | `community_votes` | One Harmless/Suspicious/Malicious vote per user per artifact |
| 13 | `comment_reports` | Reports submitted against comments |
| 14 | `moderation_actions` | Moderator actions such as hide/delete/ban |
| 15 | `notifications` | Scan, reply, moderation and system notifications |
| 16 | `api_keys` | Hashed credentials for the public API |
| 17 | `api_request_logs` | API usage and rate-limit analytics |
| 18 | `llm_usage_logs` | LLM usage metrics without storing prompts or responses |
| 19 | `audit_logs` | Security/admin audit trail |

## Important rules already modeled

- Files are deduplicated by unique SHA-256.
- URLs are deduplicated by a unique normalized URL hash.
- Anonymous submissions are supported with a nullable `user_id`.
- Public/private visibility belongs to submissions and scans.
- A file can be deleted after scanning while its hashes, metadata and results remain.
- Scan history is kept, so rescans do not overwrite older results.
- A scan stores each engine result separately.
- Comments support unlimited nesting through `parent_id`.
- A user can have only one active community vote per artifact.
- API keys are stored as hashes, not plaintext keys.
- LLM prompts and generated responses are intentionally not stored.
- Admin analytics can be calculated from the normal application tables.

## Development behavior

For this early development phase the backend container runs:

```bash
npx prisma generate
npx prisma db push
npm run start:dev
```

So `docker compose up --build` automatically synchronizes the Prisma schema with the local development database.

Once the schema is stable, switch from `prisma db push` to versioned Prisma migrations before production.
