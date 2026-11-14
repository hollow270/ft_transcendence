import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';

const ROLES = new Set<string>(Object.values(UserRole));
const STATUSES = new Set<string>([UserStatus.ACTIVE, UserStatus.DISABLED]);

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: {
    q?: string;
    role?: string;
    status?: string;
    page?: string;
    pageSize?: string;
  }) {
    const page = Math.max(1, Number(input.page) || 1);
    const pageSize = Math.min(100, Math.max(5, Number(input.pageSize) || 20));
    const q = input.q?.trim();

    const where: Prisma.UserWhereInput = {
      status: { not: UserStatus.DELETED },
      ...(q
        ? {
            OR: [
              { username: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(input.role && ROLES.has(input.role)
        ? { role: input.role as UserRole }
        : {}),
      ...(input.status && STATUSES.has(input.status)
        ? { status: input.status as UserStatus }
        : {}),
    };

    const now = new Date();
    const [total, users, counts] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
          commentBannedUntil: true,
          twoFactor: { select: { enabled: true } },
          _count: { select: { submissions: true, comments: true } },
          sessions: {
            orderBy: { lastSeenAt: 'desc' },
            take: 1,
            select: { lastSeenAt: true },
          },
        },
      }),
      this.prisma.user.groupBy({
        by: ['status'],
        where: { status: { not: UserStatus.DELETED } },
        _count: { _all: true },
      }),
    ]);

    const sessionCounts = await this.prisma.userSession.groupBy({
      by: ['userId'],
      where: {
        userId: { in: users.map((user) => user.id) },
        revokedAt: null,
        expiresAt: { gt: now },
      },
      _count: { _all: true },
    });
    const sessionsByUser = new Map(
      sessionCounts.map((row) => [row.userId, row._count._all]),
    );

    return {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      totals: {
        active: counts.find((row) => row.status === UserStatus.ACTIVE)?._count._all ?? 0,
        disabled: counts.find((row) => row.status === UserStatus.DISABLED)?._count._all ?? 0,
      },
      items: users.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        commentBannedUntil: user.commentBannedUntil,
        twoFactorEnabled: user.twoFactor?.enabled ?? false,
        submissions: user._count.submissions,
        comments: user._count.comments,
        activeSessions: sessionsByUser.get(user.id) ?? 0,
        lastSeenAt: user.sessions[0]?.lastSeenAt ?? null,
      })),
    };
  }

  async update(
    actorId: string,
    targetId: string,
    input: { role?: string; status?: string },
  ) {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target || target.status === UserStatus.DELETED) {
      throw new NotFoundException('user not found');
    }

    const data: Prisma.UserUpdateInput = {};
    const changes: Record<string, { from: string; to: string }> = {};

    if (input.role !== undefined) {
      if (!ROLES.has(input.role)) throw new BadRequestException('invalid role');
      if (targetId === actorId && input.role !== UserRole.ADMIN) {
        throw new BadRequestException('you cannot remove your own admin role');
      }
      if (input.role !== target.role) {
        data.role = input.role as UserRole;
        changes.role = { from: target.role, to: input.role };
      }
    }

    if (input.status !== undefined) {
      if (!STATUSES.has(input.status)) throw new BadRequestException('invalid status');
      if (targetId === actorId && input.status !== UserStatus.ACTIVE) {
        throw new BadRequestException('you cannot disable your own account');
      }
      if (input.status !== target.status) {
        data.status = input.status as UserStatus;
        changes.status = { from: target.status, to: input.status };
      }
    }

    if (!Object.keys(changes).length) {
      return { success: true, changed: false };
    }

    const ops: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.user.update({ where: { id: targetId }, data }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: actorId,
          action: 'admin.user_updated',
          targetType: 'user',
          targetId,
          metadata: changes as Prisma.InputJsonValue,
        },
      }),
    ];

    if (changes.status?.to === UserStatus.DISABLED) {
      ops.push(
        this.prisma.userSession.updateMany({
          where: { userId: targetId, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
      );
    }

    if (changes.role) {
      ops.push(
        this.prisma.notification.create({
          data: {
            userId: targetId,
            actorUserId: actorId,
            type: NotificationType.SYSTEM,
            entityType: 'user',
            entityId: targetId,
            message: 'Your role was changed to ' + changes.role.to.toLowerCase() + '.',
          },
        }),
      );
    }

    await this.prisma.$transaction(ops);
    return { success: true, changed: true };
  }

  async revokeSessions(actorId: string, targetId: string) {
    const result = await this.prisma.userSession.updateMany({
      where: { userId: targetId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actorId,
        action: 'admin.user_sessions_revoked',
        targetType: 'user',
        targetId,
        metadata: { count: result.count },
      },
    });

    return { success: true, revoked: result.count };
  }
}
