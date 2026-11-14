import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import {
  ArtifactType,
  ReportStatus,
  ScanStatus,
  UserStatus,
  Verdict,
} from '@prisma/client';
import PDFDocument = require('pdfkit');
import { PrismaService } from '../prisma.service';

type ActivityPoint = {
  date: string;
  users: number;
  files: number;
  urls: number;
  scans: number;
  apiRequests: number;
};

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const now = new Date();
    const onlineSince = new Date(
      now.getTime() - 5 * 60 * 1000,
    );
    const dayAgo = new Date(
      now.getTime() -
        24 * 60 * 60 * 1000,
    );

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
      votes,
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
          overallVerdict:
            Verdict.MALICIOUS,
        },
      }),
      this.prisma.scan.count({
        where: {
          overallVerdict:
            Verdict.SUSPICIOUS,
        },
      }),
      this.prisma.scan.count({
        where: {
          overallVerdict:
            Verdict.HARMLESS,
        },
      }),
      this.prisma.scan.count({
        where: {
          overallVerdict:
            Verdict.UNKNOWN,
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
      this.prisma.communityVote.count(),
      this.prisma.commentReport.count({
        where: {
          status: {
            in: [
              ReportStatus.OPEN,
              ReportStatus.REVIEWING,
            ],
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
        total:
          fileSubmissions +
          urlSubmissions,
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
        votes,
        openReports,
      },
      llm: {
        requests: llmRequests,
        requests24h: llmRequests24h,
      },
      recentUsers,
      recentAudit: recentAudit.map(
        (entry) => ({
          id: entry.id,
          action: entry.action,
          targetType:
            entry.targetType,
          targetId: entry.targetId,
          metadata: entry.metadata,
          createdAt: entry.createdAt,
          actor: entry.actor ?? null,
        }),
      ),
    };
  }

  async activity(
    daysInput?: string,
    fromInput?: string,
    toInput?: string,
  ) {
    const { start, endExclusive } =
      this.resolveRange(
        daysInput,
        fromInput,
        toInput,
      );

    const [
      users,
      submissions,
      scans,
      apiRequests,
    ] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          createdAt: {
            gte: start,
            lt: endExclusive,
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
            lt: endExclusive,
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
            lt: endExclusive,
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
            lt: endExclusive,
          },
        },
        select: {
          createdAt: true,
        },
      }),
    ]);

    const buckets =
      new Map<string, ActivityPoint>();

    const days =
      Math.round(
        (endExclusive.getTime() -
          start.getTime()) /
          (24 * 60 * 60 * 1000),
      );

    for (
      let offset = 0;
      offset < days;
      offset += 1
    ) {
      const date = new Date(start);
      date.setUTCDate(
        start.getUTCDate() + offset,
      );
      const key =
        date.toISOString().slice(0, 10);

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
      const bucket =
        buckets.get(
          keyFor(user.createdAt),
        );
      if (bucket) bucket.users += 1;
    }

    for (
      const submission of submissions
    ) {
      const bucket =
        buckets.get(
          keyFor(
            submission.createdAt,
          ),
        );
      if (!bucket) continue;

      if (
        submission.artifact.type ===
        ArtifactType.FILE
      ) {
        bucket.files += 1;
      } else {
        bucket.urls += 1;
      }
    }

    for (const scan of scans) {
      const bucket =
        buckets.get(
          keyFor(scan.createdAt),
        );
      if (bucket) bucket.scans += 1;
    }

    for (
      const request of apiRequests
    ) {
      const bucket =
        buckets.get(
          keyFor(request.createdAt),
        );
      if (bucket) {
        bucket.apiRequests += 1;
      }
    }

    return Array.from(
      buckets.values(),
    );
  }

  async exportCsv(
    fromInput?: string,
    toInput?: string,
  ) {
    const overview =
      await this.overview();
    const activity =
      await this.activity(
        undefined,
        fromInput,
        toInput,
      );

    const rows: Array<
      Array<string | number>
    > = [
      ['metric', 'value'],
      [
        'registered_users',
        overview.users.registered,
      ],
      [
        'active_users',
        overview.users.active,
      ],
      [
        'users_online_now',
        overview.users.onlineNow,
      ],
      [
        'file_submissions',
        overview.submissions.files,
      ],
      [
        'url_submissions',
        overview.submissions.urls,
      ],
      [
        'total_submissions',
        overview.submissions.total,
      ],
      [
        'total_scans',
        overview.scans.total,
      ],
      [
        'completed_scans',
        overview.scans.completed,
      ],
      [
        'running_scans',
        overview.scans.running,
      ],
      [
        'failed_scans',
        overview.scans.failed,
      ],
      [
        'malicious_scans',
        overview.scans.verdicts
          .MALICIOUS,
      ],
      [
        'suspicious_scans',
        overview.scans.verdicts
          .SUSPICIOUS,
      ],
      [
        'harmless_scans',
        overview.scans.verdicts
          .HARMLESS,
      ],
      [
        'unknown_scans',
        overview.scans.verdicts
          .UNKNOWN,
      ],
      [
        'api_requests',
        overview.api.requests,
      ],
      [
        'api_requests_24h',
        overview.api.requests24h,
      ],
      [
        'api_errors_24h',
        overview.api.errors24h,
      ],
      [
        'active_api_keys',
        overview.api.activeKeys,
      ],
      [
        'comments',
        overview.community.comments,
      ],
      [
        'community_votes',
        overview.community.votes,
      ],
      [
        'open_reports',
        overview.community.openReports,
      ],
      [
        'llm_requests',
        overview.llm.requests,
      ],
      [
        'llm_requests_24h',
        overview.llm.requests24h,
      ],
      [],
      [
        'date',
        'new_users',
        'file_submissions',
        'url_submissions',
        'scans',
        'api_requests',
      ],
      ...activity.map((point) => [
        point.date,
        point.users,
        point.files,
        point.urls,
        point.scans,
        point.apiRequests,
      ]),
    ];

    return rows
      .map((row) =>
        row
          .map((value) =>
            '"' +
            String(value).replace(
              /"/g,
              '""',
            ) +
            '"',
          )
          .join(','),
      )
      .join('\n');
  }

  async exportPdf(
    fromInput?: string,
    toInput?: string,
  ) {
    const overview =
      await this.overview();
    const activity =
      await this.activity(
        undefined,
        fromInput,
        toInput,
      );

    return new Promise<Buffer>(
      (resolve, reject) => {
        const doc =
          new PDFDocument({
            size: 'A4',
            margin: 48,
          });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) =>
          chunks.push(
            Buffer.isBuffer(chunk)
              ? chunk
              : Buffer.from(chunk),
          ),
        );
        doc.on('end', () =>
          resolve(
            Buffer.concat(chunks),
          ),
        );
        doc.on('error', reject);

        doc
          .fontSize(20)
          .text(
            'GO VIRUS Admin Analytics',
          );
        doc
          .moveDown(0.4)
          .fontSize(9)
          .fillColor('#666666')
          .text(
            'Generated ' +
              new Date().toISOString(),
          );

        doc
          .moveDown()
          .fillColor('#000000')
          .fontSize(12)
          .text('Platform metrics');

        const metrics = [
          [
            'Registered users',
            overview.users.registered,
          ],
          [
            'Online now',
            overview.users.onlineNow,
          ],
          [
            'File submissions',
            overview.submissions.files,
          ],
          [
            'URL submissions',
            overview.submissions.urls,
          ],
          [
            'Total scans',
            overview.scans.total,
          ],
          [
            'Malicious scans',
            overview.scans.verdicts
              .MALICIOUS,
          ],
          [
            'Community votes',
            overview.community.votes,
          ],
          [
            'API requests',
            overview.api.requests,
          ],
          [
            'LLM requests',
            overview.llm.requests,
          ],
        ] as const;

        for (
          const [label, value] of metrics
        ) {
          doc
            .fontSize(10)
            .text(
              label +
                ': ' +
                value.toLocaleString(),
            );
        }

        doc
          .moveDown()
          .fontSize(12)
          .text('Activity');

        for (
          const point of activity
        ) {
          doc
            .fontSize(8)
            .text(
              point.date +
                ' | users ' +
                point.users +
                ' | files ' +
                point.files +
                ' | URLs ' +
                point.urls +
                ' | scans ' +
                point.scans +
                ' | API ' +
                point.apiRequests,
            );

          if (
            doc.y >
            doc.page.height - 70
          ) {
            doc.addPage();
          }
        }

        doc.end();
      },
    );
  }

  private resolveRange(
    daysInput?: string,
    fromInput?: string,
    toInput?: string,
  ) {
    if (fromInput || toInput) {
      if (
        !fromInput ||
        !toInput ||
        !/^\d{4}-\d{2}-\d{2}$/.test(
          fromInput,
        ) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(
          toInput,
        )
      ) {
        throw new BadRequestException(
          'custom range requires from and to in YYYY-MM-DD format',
        );
      }

      const start = new Date(
        fromInput + 'T00:00:00.000Z',
      );
      const end = new Date(
        toInput + 'T00:00:00.000Z',
      );

      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end < start
      ) {
        throw new BadRequestException(
          'invalid analytics date range',
        );
      }

      const days =
        Math.round(
          (end.getTime() -
            start.getTime()) /
            (24 * 60 * 60 * 1000),
        ) + 1;

      if (days > 366) {
        throw new BadRequestException(
          'analytics date range cannot exceed 366 days',
        );
      }

      const endExclusive =
        new Date(end);
      endExclusive.setUTCDate(
        endExclusive.getUTCDate() + 1,
      );

      return {
        start,
        endExclusive,
      };
    }

    const parsed =
      Number(daysInput ?? 7);
    const days =
      Number.isInteger(parsed) &&
      parsed >= 1 &&
      parsed <= 366
        ? parsed
        : 7;

    const start = new Date();
    start.setUTCHours(
      0,
      0,
      0,
      0,
    );
    start.setUTCDate(
      start.getUTCDate() -
        (days - 1),
    );

    const endExclusive =
      new Date();
    endExclusive.setUTCHours(
      0,
      0,
      0,
      0,
    );
    endExclusive.setUTCDate(
      endExclusive.getUTCDate() + 1,
    );

    return {
      start,
      endExclusive,
    };
  }
}
