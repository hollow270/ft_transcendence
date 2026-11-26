# Frontend / Prisma model coverage

Every Prisma application model has a working frontend surface.

| Prisma model | Frontend route / surface |
|---|---|
| User | auth pages, role-aware navigation, settings |
| UserTwoFactor | /app/settings/security |
| UserSession | session restore, device list in /app/settings |
| Artifact | /app/artifact/:artifactId |
| FileArtifact | landing scanner, /app/scan, /app/artifact/:artifactId |
| UrlArtifact | /app/url, /app/artifact/:artifactId |
| Submission | scanner, /app/history (including delete) |
| Scan | /app/artifact/:artifactId |
| ScanEngine | /app/artifact/:artifactId detection table |
| ScanEngineResult | /app/artifact/:artifactId detection table |
| Comment | /app/artifact/:artifactId community tab |
| CommunityVote | /app/artifact/:artifactId community tab |
| CommentVote | /app/artifact/:artifactId community tab |
| CommentReport | /app/artifact/:artifactId, /app/moderation |
| ModerationAction | /app/moderation |
| Notification | /app/notifications and live WebSocket delivery |
| ApiKey | /app/api-keys |
| ApiRequestLog | /app/api-keys and /app/admin |
| LlmUsageLog | /app/admin (anonymous usage counters) |
| AuditLog | /app/admin |
