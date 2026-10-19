import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { PrismaService } from '../prisma.service';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keyLength: number,
) => Promise<Buffer>;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(input: {
    username?: string;
    email?: string;
    password?: string;
  }) {
    const username = input.username?.trim();
    const email = input.email?.trim().toLowerCase();
    const password = input.password ?? '';

    if (!username || username.length < 3 || username.length > 50) {
      throw new BadRequestException(
        'username must contain between 3 and 50 characters',
      );
    }

    if (!email || !email.includes('@')) {
      throw new BadRequestException('a valid email is required');
    }

    if (password.length < 8) {
      throw new BadRequestException(
        'password must contain at least 8 characters',
      );
    }

    const passwordHash = await this.hashPassword(password);

    try {
      const user = await this.prisma.user.create({
        data: {
          username,
          email,
          passwordHash,
        },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
        },
      });

      return user;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('username or email already exists');
      }

      throw error;
    }
  }

  async login(input: { email?: string; password?: string }) {
    const email = input.email?.trim().toLowerCase();
    const password = input.password ?? '';

    if (!email || !password) {
      throw new BadRequestException('email and password are required');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      !(await this.verifyPassword(password, user.passwordHash))
    ) {
      throw new UnauthorizedException('invalid credentials');
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      token,
      tokenType: 'Bearer',
      expiresAt,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    };
  }

  async logout(token: string) {
    const session = await this.findValidSession(token);

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  async requireUserFromAuthorization(authorization?: string) {
    const token = this.extractBearerToken(authorization);

    if (!token) {
      throw new UnauthorizedException('authentication required');
    }

    const session = await this.findValidSession(token);
    await this.touchSession(session.id);

    return session.user;
  }

  async optionalUserFromAuthorization(authorization?: string) {
    if (!authorization) {
      return null;
    }

    const token = this.extractBearerToken(authorization);

    if (!token) {
      throw new UnauthorizedException('invalid authorization header');
    }

    const session = await this.findValidSession(token);
    await this.touchSession(session.id);

    return session.user;
  }

  private extractBearerToken(authorization?: string) {
    if (!authorization) {
      return null;
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }

  private async findValidSession(token: string) {
    const tokenHash = this.hashToken(token);

    const session = await this.prisma.userSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== UserStatus.ACTIVE
    ) {
      throw new UnauthorizedException('session is invalid or expired');
    }

    return session;
  }

  private async touchSession(sessionId: string) {
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { lastSeenAt: new Date() },
    });
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const derived = await scryptAsync(password, salt, 64);

    return `scrypt$${salt}$${derived.toString('hex')}`;
  }

  private async verifyPassword(password: string, stored: string) {
    const [algorithm, salt, expectedHex] = stored.split('$');

    if (algorithm !== 'scrypt' || !salt || !expectedHex) {
      return false;
    }

    const expected = Buffer.from(expectedHex, 'hex');
    const actual = await scryptAsync(password, salt, expected.length);

    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }
}
