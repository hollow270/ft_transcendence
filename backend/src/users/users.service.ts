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
