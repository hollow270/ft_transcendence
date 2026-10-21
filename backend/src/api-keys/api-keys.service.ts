import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.apiKey.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        rateLimitPerMinute: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
      },
    });
  }

  async create(
    userId: string,
    nameInput?: string,
  ) {
    const name = nameInput?.trim();

    if (!name || name.length > 100) {
      throw new BadRequestException(
        'API key name must contain between 1 and 100 characters',
      );
    }

    const activeCount =
      await this.prisma.apiKey.count({
        where: {
          userId,
          revokedAt: null,
        },
      });

    if (activeCount >= 10) {
      throw new BadRequestException(
        'You can have at most 10 active API keys.',
      );
    }

    const plaintext =
      'gv_' +
      randomBytes(32).toString('base64url');
    const keyHash = this.hashKey(plaintext);
    const keyPrefix = plaintext.slice(0, 12);

    const apiKey =
      await this.prisma.apiKey.create({
        data: {
          userId,
          name,
          keyPrefix,
          keyHash,
        },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          rateLimitPerMinute: true,
          createdAt: true,
          lastUsedAt: true,
          revokedAt: true,
        },
      });

    return {
      ...apiKey,
      key: plaintext,
    };
  }

  async revoke(
    userId: string,
    apiKeyId: string,
  ) {
    const apiKey =
      await this.prisma.apiKey.findFirst({
        where: {
          id: apiKeyId,
          userId,
        },
      });

    if (!apiKey) {
      throw new NotFoundException(
        'API key not found',
      );
    }

    if (!apiKey.revokedAt) {
      await this.prisma.apiKey.update({
        where: {
          id: apiKey.id,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    return {
      success: true,
    };
  }

  async authenticateRequest(
    plaintext: string | undefined,
    method: string,
    route: string,
  ) {
    if (!plaintext) {
      throw new UnauthorizedException(
        'X-API-Key header is required',
      );
    }

    const keyHash = this.hashKey(plaintext);
    const apiKey =
      await this.prisma.apiKey.findUnique({
        where: {
          keyHash,
        },
        include: {
          user: true,
        },
      });

    if (
      !apiKey ||
      apiKey.revokedAt ||
      apiKey.user.status !== UserStatus.ACTIVE
    ) {
      throw new UnauthorizedException(
        'invalid or revoked API key',
      );
    }

    const windowStart = new Date(
      Date.now() - 60_000,
    );
    const used =
      await this.prisma.apiRequestLog.count({
        where: {
          apiKeyId: apiKey.id,
          createdAt: {
            gte: windowStart,
          },
        },
      });

    if (
      used >= apiKey.rateLimitPerMinute
    ) {
      await this.prisma.apiRequestLog.create({
        data: {
          apiKeyId: apiKey.id,
          userId: apiKey.userId,
          method,
          route,
          statusCode:
            HttpStatus.TOO_MANY_REQUESTS,
          durationMs: 0,
        },
      });

      throw new HttpException(
        'API rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const [log] = await this.prisma.$transaction([
      this.prisma.apiRequestLog.create({
        data: {
          apiKeyId: apiKey.id,
          userId: apiKey.userId,
          method,
          route,
          statusCode: 102,
        },
      }),
      this.prisma.apiKey.update({
        where: {
          id: apiKey.id,
        },
        data: {
          lastUsedAt: new Date(),
        },
      }),
    ]);

    return {
      apiKeyId: apiKey.id,
      userId: apiKey.userId,
      rateLimitPerMinute:
        apiKey.rateLimitPerMinute,
      logId: log.id,
    };
  }

  async completeRequest(
    logId: string,
    statusCode: number,
    durationMs: number,
    artifactId?: string | null,
  ) {
    await this.prisma.apiRequestLog
      .update({
        where: {
          id: logId,
        },
        data: {
          statusCode,
          durationMs,
          artifactId:
            artifactId ?? undefined,
        },
      })
      .catch(() => undefined);
  }

  private hashKey(value: string) {
    return createHash('sha256')
      .update(value)
      .digest('hex');
  }
}
