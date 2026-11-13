import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CommentStatus,
  ModerationActionType,
  NotificationType,
  ReportStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';

type ResolveAction =
  | 'HIDE_COMMENT'
  | 'DELETE_COMMENT'
  | 'BAN_COMMENTING'
  | 'NO_ACTION';

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async listReports(
    statusInput?: string,
  ) {
    const status = (
      statusInput ?? ReportStatus.OPEN
    ).toUpperCase() as ReportStatus;

    if (
      !Object.values(ReportStatus).includes(
        status,
      )
    ) {
      throw new BadRequestException(
        'invalid report status',
      );
    }

    const reports =
      await this.prisma.commentReport.findMany({
        where: {
          status,
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: 100,
        include: {
          reporter: {
            select: {
              id: true,
              username: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              username: true,
            },
          },
          comment: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                },
              },
              artifact: {
                include: {
                  file: true,
                  url: true,
                  submissions: {
                    where: {
                      visibility: 'PUBLIC',
                    },
                    orderBy: {
                      createdAt: 'desc',
                    },
                    take: 1,
                    select: {
                      originalFilename: true,
                      originalUrl: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

    return reports.map((report) => {
      const publicSubmission =
        report.comment.artifact
          .submissions[0] ?? null;

      return {
        id: report.id,
        reason: report.reason,
        details: report.details,
        status: report.status,
        createdAt: report.createdAt,
        reviewedAt: report.reviewedAt,
        reporter: report.reporter,
        reviewedBy:
          report.reviewedBy ?? null,
        comment: {
          id: report.comment.id,
          body: report.comment.body,
          status: report.comment.status,
          createdAt:
            report.comment.createdAt,
          user: report.comment.user,
        },
        artifact: {
          id: report.comment.artifact.id,
          type:
            report.comment.artifact.type,
          displayName:
            publicSubmission?.originalFilename ??
            publicSubmission?.originalUrl ??
            report.comment.artifact.file
              ?.sha256 ??
            report.comment.artifact.url
              ?.normalizedUrl ??
            report.comment.artifact.id,
        },
      };
    });
  }

  async resolveReport(
    reportId: string,
    moderatorId: string,
    input: {
      action?: string;
      reason?: string;
      banDays?: number;
    },
  ) {
    const action = (
      input.action ?? ''
    ).toUpperCase() as ResolveAction;

    if (
      ![
        'HIDE_COMMENT',
        'DELETE_COMMENT',
        'BAN_COMMENTING',
        'NO_ACTION',
      ].includes(action)
    ) {
      throw new BadRequestException(
        'action must be HIDE_COMMENT, DELETE_COMMENT, BAN_COMMENTING or NO_ACTION',
      );
    }

    const reason =
      input.reason?.trim() || null;

    if (
      reason &&
      reason.length > 2000
    ) {
      throw new BadRequestException(
        'moderation reason must contain at most 2000 characters',
      );
    }

    const banDays = Number(
      input.banDays ?? 7,
    );

    if (
      action === 'BAN_COMMENTING' &&
      (!Number.isInteger(banDays) ||
        banDays < 1 ||
        banDays > 365)
    ) {
      throw new BadRequestException(
        'banDays must be an integer between 1 and 365',
      );
    }

    const report =
      await this.prisma.commentReport.findUnique({
        where: {
          id: reportId,
        },
        include: {
          comment: true,
        },
      });

    if (!report) {
      throw new NotFoundException(
        'report not found',
      );
    }

    if (
      report.status ===
        ReportStatus.RESOLVED ||
      report.status ===
        ReportStatus.REJECTED
    ) {
      throw new BadRequestException(
        'report is already closed',
      );
    }

    const reviewedAt = new Date();

    const result =
      await this.prisma.$transaction(
        async (tx) => {
          if (
            action === 'HIDE_COMMENT'
          ) {
            await tx.comment.update({
              where: {
                id: report.commentId,
              },
              data: {
                status:
                  CommentStatus.HIDDEN,
              },
            });

            await tx.moderationAction.create({
              data: {
                moderatorId,
                targetUserId:
                  report.comment.userId,
                commentId:
                  report.commentId,
                action:
                  ModerationActionType.HIDE_COMMENT,
                reason,
              },
            });
          }

          if (
            action === 'DELETE_COMMENT'
          ) {
            await tx.comment.update({
              where: {
                id: report.commentId,
              },
              data: {
                status:
                  CommentStatus.DELETED,
                body: '[deleted]',
                deletedAt:
                  reviewedAt,
              },
            });

            await tx.moderationAction.create({
              data: {
                moderatorId,
                targetUserId:
                  report.comment.userId,
                commentId:
                  report.commentId,
                action:
                  ModerationActionType.DELETE_COMMENT,
                reason,
              },
            });
          }

          if (
            action === 'BAN_COMMENTING'
          ) {
            const until = new Date(
              reviewedAt.getTime() +
                banDays *
                  24 *
                  60 *
                  60 *
                  1000,
            );

            await tx.user.update({
              where: {
                id: report.comment.userId,
              },
              data: {
                commentBannedUntil: until,
              },
            });

            await tx.moderationAction.create({
              data: {
                moderatorId,
                targetUserId:
                  report.comment.userId,
                commentId:
                  report.commentId,
                action:
                  ModerationActionType.BAN_COMMENTING,
                reason:
                  reason ??
                  'Commenting suspended for ' +
                    banDays +
                    ' days',
              },
            });
          }

          const updated =
            await tx.commentReport.update({
              where: {
                id: report.id,
              },
              data: {
                status:
                  action === 'NO_ACTION'
                    ? ReportStatus.REJECTED
                    : ReportStatus.RESOLVED,
                reviewedById:
                  moderatorId,
                reviewedAt,
              },
            });

          await tx.notification.create({
            data: {
              userId:
                report.comment.userId,
              actorUserId:
                moderatorId,
              type:
                NotificationType.COMMENT_MODERATED,
              artifactId:
                report.comment.artifactId,
              commentId:
                report.commentId,
              entityType:
                'comment_report',
              entityId:
                report.id,
              message:
                action === 'NO_ACTION'
                  ? 'A report involving your comment was reviewed with no moderation action.'
                  : 'A moderator reviewed a report involving your comment.',
            },
          });

          await tx.auditLog.create({
            data: {
              actorUserId:
                moderatorId,
              action:
                'MODERATION_REPORT_' +
                action,
              targetType:
                'comment_report',
              targetId:
                report.id,
              metadata: {
                commentId:
                  report.commentId,
                targetUserId:
                  report.comment.userId,
                reason,
                ...(action ===
                'BAN_COMMENTING'
                  ? { banDays }
                  : {}),
              },
            },
          });

          return updated;
        },
      );

    return {
      id: result.id,
      status: result.status,
      reviewedAt:
        result.reviewedAt,
      action,
    };
  }
}
