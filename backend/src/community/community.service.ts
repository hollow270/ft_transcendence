import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CommentStatus,
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
