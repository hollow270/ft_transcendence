import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CommentStatus,
  Prisma,
  ReportReason,
  UserStatus,
  Verdict,
  Visibility,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  async listComments(artifactId: string) {
    await this.ensurePublicArtifact(artifactId);

    return this.prisma.comment.findMany({
      where: {
        artifactId,
        status: CommentStatus.ACTIVE,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        parentId: true,
        body: true,
        createdAt: true,
        editedAt: true,
        user: {
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
      },
    });
  }

  async createComment(
    artifactId: string,
    userId: string,
    input: { body?: string; parentId?: string },
  ) {
    await this.ensurePublicArtifact(artifactId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        commentBannedUntil: true,
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('user cannot comment');
    }

    if (
      user.commentBannedUntil &&
      user.commentBannedUntil > new Date()
    ) {
      throw new ForbiddenException('commenting is temporarily disabled');
    }

    const body = input.body?.trim();

    if (!body || body.length > 4000) {
      throw new BadRequestException(
        'comment body must contain between 1 and 4000 characters',
      );
    }

    if (input.parentId) {
      const parent = await this.prisma.comment.findFirst({
        where: {
          id: input.parentId,
          artifactId,
          status: CommentStatus.ACTIVE,
        },
        select: { id: true },
      });

      if (!parent) {
        throw new BadRequestException(
          'parent comment does not belong to this artifact',
        );
      }
    }

    return this.prisma.comment.create({
      data: {
        artifactId,
        userId,
        parentId: input.parentId ?? null,
        body,
      },
      select: {
        id: true,
        artifactId: true,
        parentId: true,
        body: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
  }

  async editComment(
    artifactId: string,
    commentId: string,
    userId: string,
    bodyInput?: string,
  ) {
    await this.ensurePublicArtifact(artifactId);

    const body = bodyInput?.trim();

    if (!body || body.length > 4000) {
      throw new BadRequestException(
        'comment body must contain between 1 and 4000 characters',
      );
    }

    const comment =
      await this.prisma.comment.findFirst({
        where: {
          id: commentId,
          artifactId,
          userId,
          status: CommentStatus.ACTIVE,
        },
      });

    if (!comment) {
      throw new NotFoundException(
        'comment not found or not editable by this user',
      );
    }

    return this.prisma.comment.update({
      where: {
        id: comment.id,
      },
      data: {
        body,
        editedAt: new Date(),
      },
      select: {
        id: true,
        parentId: true,
        body: true,
        createdAt: true,
        editedAt: true,
        user: {
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
      },
    });
  }

  async deleteComment(
    artifactId: string,
    commentId: string,
    userId: string,
  ) {
    await this.ensurePublicArtifact(artifactId);

    const comment =
      await this.prisma.comment.findFirst({
        where: {
          id: commentId,
          artifactId,
          userId,
          status: CommentStatus.ACTIVE,
        },
      });

    if (!comment) {
      throw new NotFoundException(
        'comment not found or not deletable by this user',
      );
    }

    await this.prisma.comment.update({
      where: {
        id: comment.id,
      },
      data: {
        status: CommentStatus.DELETED,
        body: '[deleted]',
        deletedAt: new Date(),
      },
    });

    return {
      success: true,
    };
  }

  async reportComment(
    artifactId: string,
    commentId: string,
    reporterId: string,
    input: {
      reason?: string;
      details?: string;
    },
  ) {
    await this.ensurePublicArtifact(artifactId);

    const comment =
      await this.prisma.comment.findFirst({
        where: {
          id: commentId,
          artifactId,
          status: CommentStatus.ACTIVE,
        },
        select: {
          id: true,
          userId: true,
        },
      });

    if (!comment) {
      throw new NotFoundException(
        'comment not found',
      );
    }

    if (comment.userId === reporterId) {
      throw new BadRequestException(
        'you cannot report your own comment',
      );
    }

    const reason = (
      input.reason ?? ''
    ).toUpperCase() as ReportReason;

    if (
      !Object.values(ReportReason).includes(
        reason,
      )
    ) {
      throw new BadRequestException(
        'reason must be SPAM, ABUSIVE, DANGEROUS_MISINFORMATION or OTHER',
      );
    }

    const details =
      input.details?.trim() || null;

    if (
      details &&
      details.length > 2000
    ) {
      throw new BadRequestException(
        'report details must contain at most 2000 characters',
      );
    }

    try {
      return await this.prisma.commentReport.create({
        data: {
          commentId: comment.id,
          reporterId,
          reason,
          details,
        },
        select: {
          id: true,
          commentId: true,
          reason: true,
          details: true,
          status: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'you already reported this comment',
        );
      }

      throw error;
    }
  }

  async vote(
    artifactId: string,
    userId: string,
    verdictInput?: string,
  ) {
    await this.ensurePublicArtifact(artifactId);

    const verdict = (verdictInput ?? '').toUpperCase();

    if (
      verdict !== Verdict.HARMLESS &&
      verdict !== Verdict.SUSPICIOUS &&
      verdict !== Verdict.MALICIOUS
    ) {
      throw new BadRequestException(
        'verdict must be HARMLESS, SUSPICIOUS or MALICIOUS',
      );
    }

    const vote = await this.prisma.communityVote.upsert({
      where: {
        artifactId_userId: {
          artifactId,
          userId,
        },
      },
      update: {
        verdict: verdict as Verdict,
      },
      create: {
        artifactId,
        userId,
        verdict: verdict as Verdict,
      },
    });

    return {
      artifactId: vote.artifactId,
      userId: vote.userId,
      verdict: vote.verdict,
      updatedAt: vote.updatedAt,
    };
  }

  async voteSummary(artifactId: string) {
    await this.ensurePublicArtifact(artifactId);

    const groups = await this.prisma.communityVote.groupBy({
      by: ['verdict'],
      where: { artifactId },
      _count: {
        verdict: true,
      },
    });

    return {
      artifactId,
      counts: {
        HARMLESS:
          groups.find((group) => group.verdict === Verdict.HARMLESS)
            ?._count.verdict ?? 0,
        SUSPICIOUS:
          groups.find((group) => group.verdict === Verdict.SUSPICIOUS)
            ?._count.verdict ?? 0,
        MALICIOUS:
          groups.find((group) => group.verdict === Verdict.MALICIOUS)
            ?._count.verdict ?? 0,
      },
    };
  }

  private async ensurePublicArtifact(artifactId: string) {
    const publicSubmission = await this.prisma.submission.findFirst({
      where: {
        artifactId,
        visibility: Visibility.PUBLIC,
      },
      select: { id: true },
    });

    if (!publicSubmission) {
      throw new NotFoundException('public artifact not found');
    }
  }
}
