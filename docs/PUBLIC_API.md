# GO VIRUS Public API

The public API is available under `/api/v1` and requires an API key in the `X-API-Key` header.

Create and revoke API keys from **Profile → API keys**.

## Authentication

```http
X-API-Key: gv_your_key
```

Plaintext API keys are displayed once. GO VIRUS stores only a SHA-256 hash plus a safe display prefix.

Each key is rate-limited. The default per-key limit is 60 requests per minute.

## Endpoints

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/v1/search?q=...` | Search public artifacts |
| GET | `/api/v1/artifacts/:artifactId` | Read one public artifact |
| POST | `/api/v1/urls` | Submit a public URL |
| POST | `/api/v1/files` | Submit a public file |
| PUT | `/api/v1/artifacts/:artifactId/rescan` | Request a rescan for an artifact submitted by the API-key owner |
| DELETE | `/api/v1/submissions/:submissionId` | Delete one API-origin submission owned by the API-key owner |

API submissions are always public and use `source = API`.

Private submissions are never exposed through the public API.

## Examples

Search:

```bash
curl \
  -H "X-API-Key: YOUR_KEY" \
  "http://localhost:3000/api/v1/search?q=example.com"
```

Submit URL:

```bash
curl -X POST \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}' \
  http://localhost:3000/api/v1/urls
```

Submit file:

```bash
curl -X POST \
  -H "X-API-Key: YOUR_KEY" \
  -F "file=@sample.bin" \
  http://localhost:3000/api/v1/files
```

Rescan:

```bash
curl -X PUT \
  -H "X-API-Key: YOUR_KEY" \
  http://localhost:3000/api/v1/artifacts/ARTIFACT_ID/rescan
```

Delete an API submission:

```bash
curl -X DELETE \
  -H "X-API-Key: YOUR_KEY" \
  http://localhost:3000/api/v1/submissions/SUBMISSION_ID
```

All public API requests are recorded in `api_request_logs` for usage and rate-limit analytics.
