import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CommentStatus,
  UserStatus,
  Visibility,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnHistory(
    userId: string,
  ) {
    const submissions =
      await this.prisma.submission.findMany({
        where: {
          userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 200,
        include: {
          artifact: {
            include: {
              file: true,
              url: true,
              scans: {
                where: {
                  OR: [
                    {
                      visibility:
                        Visibility.PUBLIC,
                    },
                    {
                      submission: {
                        is: {
                          userId,
                        },
                      },
                    },
                  ],
                },
                orderBy: {
                  createdAt: 'desc',
                },
                take: 1,
                select: {
                  id: true,
                  status: true,
                  reason: true,
                  visibility: true,
                  overallVerdict: true,
                  provider: true,
                  createdAt: true,
                  completedAt: true,
                },
              },
            },
          },
        },
      });

    return submissions.map((submission) => {
      const scan =
        submission.artifact.scans[0] ?? null;

      return {
        id: submission.id,
        artifactId: submission.artifactId,
        artifactType:
          submission.artifact.type,
        displayName:
          submission.originalFilename ??
          submission.originalUrl ??
          submission.artifact.file?.sha256 ??
          submission.artifact.url?.normalizedUrl ??
          submission.artifactId,
        visibility:
          submission.visibility,
        source: submission.source,
        createdAt:
          submission.createdAt,
        file: submission.artifact.file
          ? {
              sha256:
                submission.artifact.file.sha256,
              mimeType:
                submission.artifact.file.mimeType,
              size:
                submission.artifact.file.size.toString(),
            }
          : null,
        url: submission.artifact.url
          ? {
              normalizedUrl:
                submission.artifact.url.normalizedUrl,
              domain:
                submission.artifact.url.domain,
            }
          : null,
        latestScan: scan
          ? {
              id: scan.id,
              status: scan.status,
              reason: scan.reason,
              visibility:
                scan.visibility,
              verdict:
                scan.overallVerdict,
              provider:
                scan.provider,
              createdAt:
                scan.createdAt,
              completedAt:
                scan.completedAt,
            }
          : null,
      };
    });
  }

  async getCommunityActivity(
    targetUserId: string,
    viewerUserId: string | null,
  ) {
    const profile = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });

    if (!profile) {
      throw new NotFoundException('user not found');
    }

    const isOwner = viewerUserId === targetUserId;

    const submissions = await this.prisma.submission.findMany({
      where: {
        userId: targetUserId,
        ...(isOwner ? {} : { visibility: Visibility.PUBLIC }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
      include: {
        artifact: {
          include: {
            file: true,
            url: true,
            scans: {
              where: isOwner
                ? {
                    OR: [
                      { visibility: Visibility.PUBLIC },
                      {
                        submission: {
                          is: {
                            userId: targetUserId,
                          },
                        },
                      },
                    ],
                  }
                : {
                    visibility: Visibility.PUBLIC,
                  },
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
            },
          },
        },
      },
    });

    const comments = await this.prisma.comment.findMany({
      where: {
        userId: targetUserId,
        status: CommentStatus.ACTIVE,
        artifact: {
          submissions: {
            some: {
              visibility: Visibility.PUBLIC,
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
      include: {
        artifact: {
          include: {
            file: true,
            url: true,
            submissions: {
              where: {
                visibility: Visibility.PUBLIC,
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
    });

    return {
      user: profile,
      isOwner,
      submissions: submissions.map((submission) => {
        const latestScan = submission.artifact.scans[0] ?? null;

        return {
          id: submission.id,
          artifactId: submission.artifactId,
          artifactType: submission.artifact.type,
          displayName:
            submission.originalFilename ??
            submission.originalUrl ??
            submission.artifact.file?.sha256 ??
            submission.artifact.url?.normalizedUrl ??
            submission.artifactId,
          visibility: submission.visibility,
          createdAt: submission.createdAt,
          latestScan: latestScan
            ? {
                id: latestScan.id,
                status: latestScan.status,
                verdict: latestScan.overallVerdict,
                completedAt: latestScan.completedAt,
              }
            : null,
        };
      }),
      comments: comments.map((comment) => {
        const publicSubmission = comment.artifact.submissions[0];

        return {
          id: comment.id,
          artifactId: comment.artifactId,
          artifactType: comment.artifact.type,
          artifactDisplayName:
            publicSubmission?.originalFilename ??
            publicSubmission?.originalUrl ??
            comment.artifact.file?.sha256 ??
            comment.artifact.url?.normalizedUrl ??
            comment.artifactId,
          body: comment.body,
          createdAt: comment.createdAt,
          editedAt: comment.editedAt,
        };
      }),
    };
  }
}
