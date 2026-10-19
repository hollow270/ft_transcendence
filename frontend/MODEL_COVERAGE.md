# Frontend / Prisma model coverage

This file maps the 19 Prisma application models to the GO VIRUS frontend milestone.

| Prisma model | Frontend route / surface | Current status |
|---|---|---|
| User | Global auth shell, role-aware navigation | Wired |
| UserTwoFactor | /profile/security | UI route ready; backend endpoint pending |
| UserSession | Global authentication/session restore | Wired |
| Artifact | /artifact/:artifactId | Wired |
| FileArtifact | / and /artifact/:artifactId | Wired |
| UrlArtifact | /url and /artifact/:artifactId | Route ready; URL submission backend pending |
| Submission | / file upload, /history | File submission wired; history backend pending |
| Scan | /artifact/:artifactId | Wired |
| ScanEngine | /artifact/:artifactId detection table | Wired |
| ScanEngineResult | /artifact/:artifactId detection table | Wired |
| Comment | /artifact/:artifactId community section | Wired |
| CommunityVote | /artifact/:artifactId community section | Wired |
| CommentReport | /moderation | UI route ready; reporting/moderation backend pending |
| ModerationAction | /moderation | UI route ready; backend pending |
| Notification | /notifications + WebSocket delivery | Wired |
| ApiKey | /api-keys | UI route ready; backend pending |
| ApiRequestLog | /api-keys and /admin | UI route ready; backend pending |
| LlmUsageLog | /llm and /artifact/:artifactId AI section | AI wired; usage logs written by backend |
| AuditLog | /admin | UI route ready; backend pending |

## Rule

The frontend must not invent functionality. Pages whose NestJS endpoints are not implemented explicitly show a backend-pending state. As endpoints are added, these routes can be wired without changing the overall information architecture.
