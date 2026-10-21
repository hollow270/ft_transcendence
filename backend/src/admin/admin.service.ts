import { Injectable } from '@nestjs/common';
import {
  ArtifactType,
  ScanStatus,
  UserStatus,
  Verdict,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const now = new Date();
    const onlineSince = new Date(now.getTime() - 5 * 60 * 1000);
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      registeredUsers,
      activeUsers,
      onlineSessions,
      fileSubmissions,
      urlSubmissions,
      totalScans,
      completedScans,
      runningScans,
      failedScans,
      maliciousScans,
      suspiciousScans,
      harmlessScans,
      unknownScans,
      apiRequests,
      apiRequests24h,
      apiErrors24h,
      activeApiKeys,
      comments,
      openReports,
      llmRequests,
      llmRequests24h,
      recentUsers,
      recentAudit,
    ] = await Promise.all([
      this.prisma.user.count({
        where: {
          status: {
            not: UserStatus.DELETED,
          },
        },
      }),
      this.prisma.user.count({
        where: {
          status: UserStatus.ACTIVE,
        },
      }),
      this.prisma.userSession.findMany({
        where: {
          revokedAt: null,
          expiresAt: {
            gt: now,
          },
          lastSeenAt: {
            gte: onlineSince,
          },
          user: {
            status: UserStatus.ACTIVE,
          },
        },
        distinct: ['userId'],
        select: {
          userId: true,
        },
      }),
      this.prisma.submission.count({
        where: {
          artifact: {
            type: ArtifactType.FILE,
          },
        },
      }),
      this.prisma.submission.count({
        where: {
          artifact: {
            type: ArtifactType.URL,
          },
        },
      }),
      this.prisma.scan.count(),
      this.prisma.scan.count({
        where: {
          status: ScanStatus.COMPLETED,
        },
      }),
      this.prisma.scan.count({
        where: {
          status: {
            in: [
              ScanStatus.QUEUED,
              ScanStatus.RUNNING,
            ],
          },
        },
      }),
      this.prisma.scan.count({
        where: {
          status: ScanStatus.FAILED,
        },
      }),
      this.prisma.scan.count({
        where: {
          overallVerdict: Verdict.MALICIOUS,
        },
      }),
      this.prisma.scan.count({
        where: {
          overallVerdict: Verdict.SUSPICIOUS,
        },
      }),
      this.prisma.scan.count({
        where: {
          overallVerdict: Verdict.HARMLESS,
        },
      }),
      this.prisma.scan.count({
        where: {
          overallVerdict: Verdict.UNKNOWN,
        },
      }),
      this.prisma.apiRequestLog.count(),
      this.prisma.apiRequestLog.count({
        where: {
          createdAt: {
            gte: dayAgo,
          },
        },
      }),
      this.prisma.apiRequestLog.count({
        where: {
          createdAt: {
            gte: dayAgo,
          },
          statusCode: {
            gte: 400,
          },
        },
      }),
      this.prisma.apiKey.count({
        where: {
          revokedAt: null,
        },
      }),
      this.prisma.comment.count(),
      this.prisma.commentReport.count({
        where: {
          status: {
            in: ['OPEN', 'REVIEWING'],
          },
        },
      }),
      this.prisma.llmUsageLog.count(),
      this.prisma.llmUsageLog.count({
        where: {
          createdAt: {
            gte: dayAgo,
          },
        },
      }),
      this.prisma.user.findMany({
        where: {
          status: {
            not: UserStatus.DELETED,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.auditLog.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        take: 20,
        include: {
          actor: {
            select: {
              id: true,
              username: true,
              role: true,
            },
          },
        },
      }),
    ]);

    return {
      generatedAt: now,
      users: {
        registered: registeredUsers,
        active: activeUsers,
        onlineNow: onlineSessions.length,
      },
      submissions: {
        files: fileSubmissions,
        urls: urlSubmissions,
        total: fileSubmissions + urlSubmissions,
      },
      scans: {
        total: totalScans,
        completed: completedScans,
        running: runningScans,
        failed: failedScans,
        verdicts: {
          MALICIOUS: maliciousScans,
          SUSPICIOUS: suspiciousScans,
          HARMLESS: harmlessScans,
          UNKNOWN: unknownScans,
        },
      },
      api: {
        requests: apiRequests,
        requests24h: apiRequests24h,
        errors24h: apiErrors24h,
        activeKeys: activeApiKeys,
      },
      community: {
        comments,
        openReports,
      },
      llm: {
        requests: llmRequests,
        requests24h: llmRequests24h,
      },
      recentUsers,
      recentAudit: recentAudit.map((entry) => ({
        id: entry.id,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        metadata: entry.metadata,
        createdAt: entry.createdAt,
        actor: entry.actor ?? null,
      })),
    };
  }

  async activity(daysInput?: string) {
    const parsed = Number(daysInput ?? 7);
    const days =
      Number.isInteger(parsed) && parsed >= 1 && parsed <= 30
        ? parsed
        : 7;

    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (days - 1));

    const [users, submissions, scans, apiRequests] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          createdAt: {
            gte: start,
          },
        },
        select: {
          createdAt: true,
        },
      }),
      this.prisma.submission.findMany({
        where: {
          createdAt: {
            gte: start,
          },
        },
        select: {
          createdAt: true,
          artifact: {
            select: {
              type: true,
            },
          },
        },
      }),
      this.prisma.scan.findMany({
        where: {
          createdAt: {
            gte: start,
          },
        },
        select: {
          createdAt: true,
        },
      }),
      this.prisma.apiRequestLog.findMany({
        where: {
          createdAt: {
            gte: start,
          },
        },
        select: {
          createdAt: true,
        },
      }),
    ]);

    const buckets = new Map<
      string,
      {
        date: string;
        users: number;
        files: number;
        urls: number;
        scans: number;
        apiRequests: number;
      }
    >();

    for (let offset = 0; offset < days; offset += 1) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + offset);
      const key = date.toISOString().slice(0, 10);

      buckets.set(key, {
        date: key,
        users: 0,
        files: 0,
        urls: 0,
        scans: 0,
        apiRequests: 0,
      });
    }

    const keyFor = (value: Date) =>
      value.toISOString().slice(0, 10);

    for (const user of users) {
      const bucket = buckets.get(keyFor(user.createdAt));
      if (bucket) bucket.users += 1;
    }

    for (const submission of submissions) {
      const bucket = buckets.get(keyFor(submission.createdAt));
      if (!bucket) continue;

      if (submission.artifact.type === ArtifactType.FILE) {
        bucket.files += 1;
      } else {
        bucket.urls += 1;
      }
    }

    for (const scan of scans) {
      const bucket = buckets.get(keyFor(scan.createdAt));
      if (bucket) bucket.scans += 1;
    }

    for (const request of apiRequests) {
      const bucket = buckets.get(keyFor(request.createdAt));
      if (bucket) bucket.apiRequests += 1;
    }

    return Array.from(buckets.values());
  }

  async exportCsv() {
    const overview = await this.overview();

    const rows = [
      ['metric', 'value'],
      ['registered_users', overview.users.registered],
      ['active_users', overview.users.active],
      ['users_online_now', overview.users.onlineNow],
      ['file_submissions', overview.submissions.files],
      ['url_submissions', overview.submissions.urls],
      ['total_submissions', overview.submissions.total],
      ['total_scans', overview.scans.total],
      ['completed_scans', overview.scans.completed],
      ['running_scans', overview.scans.running],
      ['failed_scans', overview.scans.failed],
      ['malicious_scans', overview.scans.verdicts.MALICIOUS],
      ['suspicious_scans', overview.scans.verdicts.SUSPICIOUS],
      ['harmless_scans', overview.scans.verdicts.HARMLESS],
      ['unknown_scans', overview.scans.verdicts.UNKNOWN],
      ['api_requests', overview.api.requests],
      ['api_requests_24h', overview.api.requests24h],
      ['api_errors_24h', overview.api.errors24h],
      ['active_api_keys', overview.api.activeKeys],
      ['comments', overview.community.comments],
      ['open_reports', overview.community.openReports],
      ['llm_requests', overview.llm.requests],
      ['llm_requests_24h', overview.llm.requests24h],
    ];

    return rows
      .map((row) =>
        row
          .map((value) =>
            '"' + String(value).replace(/"/g, '""') + '"',
          )
          .join(','),
      )
      .join('\n');
  }
}
