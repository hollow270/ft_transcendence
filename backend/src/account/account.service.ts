import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CommentStatus,
  NotificationType,
  Prisma,
  UserStatus,
  Verdict,
} from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma.service';
import { verifyClaimToken } from '../security/claim-token';

const CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000;
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,50}$/;

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  /* ------------------------------------------------------------------ */
  /* Overview                                                           */
  /* ------------------------------------------------------------------ */

  async overview(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        twoFactor: { select: { enabled: true } },
      },
    });

    if (!user) throw new NotFoundException('user not found');

    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      submissions,
      files,
      urls,
      last30,
      comments,
      votes,
      activeKeys,
      activeSessions,
      unreadNotifications,
      recent,
      latestScans,
    ] = await Promise.all([
      this.prisma.submission.count({ where: { userId } }),
      this.prisma.submission.count({
        where: { userId, artifact: { type: 'FILE' } },
      }),
      this.prisma.submission.count({
        where: { userId, artifact: { type: 'URL' } },
      }),
      this.prisma.submission.findMany({
        where: { userId, createdAt: { gte: since30 } },
        select: { createdAt: true },
      }),
      this.prisma.comment.count({
        where: { userId, status: CommentStatus.ACTIVE },
      }),
      this.prisma.communityVote.count({ where: { userId } }),
      this.prisma.apiKey.count({ where: { userId, revokedAt: null } }),
      this.prisma.userSession.count({
        where: {
          userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
      this.prisma.notification.count({
        where: { userId, readAt: null },
      }),
      this.prisma.submission.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          artifact: {
            include: {
              file: { select: { sha256: true, size: true, mimeType: true } },
              url: { select: { normalizedUrl: true, domain: true } },
            },
          },
          scans: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              status: true,
              overallVerdict: true,
              completedAt: true,
            },
          },
        },
      }),
      // Latest scan per artifact the user submitted, to build a verdict mix.
      this.prisma.scan.findMany({
        where: { submission: { is: { userId } } },
        orderBy: { createdAt: 'desc' },
        distinct: ['artifactId'],
        select: { overallVerdict: true },
        take: 1000,
      }),
    ]);

    const verdicts: Record<Verdict, number> = {
      HARMLESS: 0,
      SUSPICIOUS: 0,
      MALICIOUS: 0,
      UNKNOWN: 0,
    };
    for (const scan of latestScans) verdicts[scan.overallVerdict] += 1;

    // 30-day activity series (oldest -> newest).
    const activity: Array<{ date: string; count: number }> = [];
    const buckets = new Map<string, number>();
    for (const item of last30) {
      const key = item.createdAt.toISOString().slice(0, 10);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    for (let offset = 29; offset >= 0; offset -= 1) {
      const date = new Date(Date.now() - offset * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      activity.push({ date, count: buckets.get(date) ?? 0 });
    }

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        twoFactorEnabled: user.twoFactor?.enabled ?? false,
      },
      stats: {
        submissions,
        files,
        urls,
        comments,
        votes,
        activeApiKeys: activeKeys,
        activeSessions,
        unreadNotifications,
        verdicts,
      },
      activity,
      recent: recent.map((submission) => {
        const scan = submission.scans[0] ?? null;
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
          size: submission.artifact.file?.size.toString() ?? null,
          latestScan: scan
            ? {
                id: scan.id,
                status: scan.status,
                verdict: scan.overallVerdict,
                completedAt: scan.completedAt,
              }
            : null,
        };
      }),
    };
  }

  /* ------------------------------------------------------------------ */
  /* Profile                                                            */
  /* ------------------------------------------------------------------ */

  async updateProfile(
    userId: string,
    input: { username?: string; email?: string; currentPassword?: string },
  ) {
    const user = await this.requireUser(userId);
    const data: Prisma.UserUpdateInput = {};
    const changed: string[] = [];

    if (input.username !== undefined) {
      const username = input.username.trim();
      if (!USERNAME_PATTERN.test(username)) {
        throw new BadRequestException(
          'username must be 3–50 characters: letters, numbers, dot, dash or underscore',
        );
      }
      if (username !== user.username) {
        data.username = username;
        changed.push('username');
      }
    }

    if (input.email !== undefined) {
      const email = input.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
        throw new BadRequestException('a valid email is required');
      }
      if (email !== user.email) {
        await this.requirePassword(user.passwordHash, input.currentPassword);
        data.email = email;
        changed.push('email');
      }
    }

    if (!changed.length) {
      return this.publicUser(user);
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data,
      });

      await this.audit(userId, 'account.profile_updated', userId, { changed });
      await this.notify(
        userId,
        'Your ' + changed.join(' and ') + ' was updated.',
      );

      return this.publicUser(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('that username or email is already taken');
      }
      throw error;
    }
  }

  async changePassword(
    userId: string,
    currentSessionId: string,
    input: { currentPassword?: string; newPassword?: string },
  ) {
    const user = await this.requireUser(userId);
    await this.requirePassword(user.passwordHash, input.currentPassword);

    const next = input.newPassword ?? '';
    if (next.length < 8 || next.length > 200) {
      throw new BadRequestException('new password must contain at least 8 characters');
    }
    if (next === input.currentPassword) {
      throw new BadRequestException('new password must differ from the current one');
    }

    const passwordHash = await this.auth.hashPassword(next);

    const [, revoked] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.userSession.updateMany({
        where: { userId, revokedAt: null, id: { not: currentSessionId } },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit(userId, 'account.password_changed', userId, {
      revokedSessions: revoked.count,
    });
    await this.notify(
      userId,
      'Your password was changed. Other devices were signed out.',
    );

    return { success: true, revokedSessions: revoked.count };
  }

  /* ------------------------------------------------------------------ */
  /* Sessions                                                           */
  /* ------------------------------------------------------------------ */

  async sessions(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
      },
    });

    return sessions.map((session) => ({
      ...session,
      current: session.id === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string, currentSessionId: string) {
    if (sessionId === currentSessionId) {
      throw new BadRequestException('use sign out to end the current session');
    }

    const result = await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (!result.count) throw new NotFoundException('session not found');

    await this.audit(userId, 'account.session_revoked', sessionId);
    return { success: true };
  }

  async revokeOtherSessions(userId: string, currentSessionId: string) {
    const result = await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null, id: { not: currentSessionId } },
      data: { revokedAt: new Date() },
    });

    await this.audit(userId, 'account.sessions_revoked', userId, {
      count: result.count,
    });
    return { success: true, revoked: result.count };
  }

  /* ------------------------------------------------------------------ */
  /* Claim anonymous scans                                              */
  /* ------------------------------------------------------------------ */

  async claim(
    userId: string,
    input: { submissionId?: string; claimToken?: string },
  ) {
    if (!input.submissionId || !input.claimToken) {
      throw new BadRequestException('submissionId and claimToken are required');
    }
    if (!verifyClaimToken(input.submissionId, input.claimToken)) {
      throw new ForbiddenException('claim token is invalid');
    }

    const submission = await this.prisma.submission.findUnique({
      where: { id: input.submissionId },
      select: { id: true, userId: true, artifactId: true, createdAt: true },
    });

    if (!submission) throw new NotFoundException('submission not found');
    if (submission.userId === userId) {
      return { success: true, artifactId: submission.artifactId };
    }
    if (submission.userId) {
      throw new ForbiddenException('submission already belongs to an account');
    }
    if (Date.now() - submission.createdAt.getTime() > CLAIM_WINDOW_MS) {
      throw new BadRequestException('claim window has expired');
    }

    await this.prisma.submission.update({
      where: { id: submission.id },
      data: { userId },
    });
    await this.audit(userId, 'account.submission_claimed', submission.id);

    return { success: true, artifactId: submission.artifactId };
  }

  /* ------------------------------------------------------------------ */
  /* Delete account                                                     */
  /* ------------------------------------------------------------------ */

  async deleteAccount(userId: string, input: { password?: string; confirm?: string }) {
    const user = await this.requireUser(userId);
    await this.requirePassword(user.passwordHash, input.password);

    if (input.confirm !== user.username) {
      throw new BadRequestException('type your username to confirm');
    }

    const now = new Date();
    const suffix = userId.slice(0, 8);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.DELETED,
          deletedAt: now,
          // Free the unique username/email so they can be reused.
          username: 'deleted-' + suffix + '-' + now.getTime().toString(36),
          email: 'deleted+' + userId + '@invalid.local',
          passwordHash: 'disabled',
        },
      }),
      this.prisma.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.apiKey.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.userTwoFactor.deleteMany({ where: { userId } }),
    ]);

    await this.audit(userId, 'account.deleted', userId);
    return { success: true };
  }

  /* ------------------------------------------------------------------ */

  private async requireUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('account is not active');
    }
    return user;
  }

  private async requirePassword(hash: string, password?: string) {
    if (!password || !(await this.auth.verifyPassword(password, hash))) {
      throw new BadRequestException('current password is incorrect');
    }
  }

  private publicUser(user: {
    id: string;
    username: string;
    email: string;
    role: string;
    status: string;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    };
  }

  private audit(
    actorUserId: string,
    action: string,
    targetId: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.auditLog.create({
      data: {
        actorUserId,
        action,
        targetType: 'user',
        targetId,
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  private notify(userId: string, message: string) {
    return this.prisma.notification.create({
      data: {
        userId,
        type: NotificationType.RESOURCE_UPDATED,
        entityType: 'user',
        entityId: userId,
        message,
      },
    });
  }
}
