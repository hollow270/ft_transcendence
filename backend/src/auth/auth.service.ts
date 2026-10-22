import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  NotificationType,
  Prisma,
  UserStatus,
} from '@prisma/client';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from 'crypto';
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
      const created =
        await this.prisma.user.create({
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

      await this.prisma.notification.create({
        data: {
          userId: created.id,
          type:
            NotificationType.RESOURCE_CREATED,
          entityType: 'user',
          entityId: created.id,
          message:
            'Your GO VIRUS account was created.',
        },
      });

      return created;
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

  async login(input: {
    email?: string;
    password?: string;
    totpCode?: string;
  }) {
    const email = input.email?.trim().toLowerCase();
    const password = input.password ?? '';

    if (!email || !password) {
      throw new BadRequestException('email and password are required');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        twoFactor: true,
      },
    });

    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      !(await this.verifyPassword(password, user.passwordHash))
    ) {
      throw new UnauthorizedException('invalid credentials');
    }

    if (user.twoFactor?.enabled) {
      if (!input.totpCode) {
        return {
          requiresTwoFactor: true as const,
        };
      }

      const secret = this.decryptTwoFactorSecret(
        user.twoFactor.secretEncrypted,
      );

      if (!this.verifyTotp(secret, input.totpCode)) {
        throw new UnauthorizedException(
          'invalid two-factor authentication code',
        );
      }
    }

    return this.createSession(user);
  }

  async twoFactorStatus(userId: string) {
    const record = await this.prisma.userTwoFactor.findUnique({
      where: { userId },
      select: {
        enabled: true,
      },
    });

    return {
      enabled: record?.enabled ?? false,
      configured: this.twoFactorEncryptionConfigured(),
    };
  }

  async setupTwoFactor(userId: string) {
    this.requireTwoFactorEncryptionKey();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        twoFactor: {
          select: {
            enabled: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('user not found');
    }

    if (user.twoFactor?.enabled) {
      throw new BadRequestException(
        'two-factor authentication is already enabled',
      );
    }

    const secret = this.base32Encode(randomBytes(20));
    const secretEncrypted = this.encryptTwoFactorSecret(secret);

    await this.prisma.userTwoFactor.upsert({
      where: { userId },
      update: {
        secretEncrypted,
        enabled: false,
      },
      create: {
        userId,
        secretEncrypted,
        enabled: false,
      },
    });

    const issuer = 'GO VIRUS';
    const label = issuer + ':' + user.email;
    const otpauthUri =
      'otpauth://totp/' +
      encodeURIComponent(label) +
      '?secret=' +
      encodeURIComponent(secret) +
      '&issuer=' +
      encodeURIComponent(issuer) +
      '&algorithm=SHA1&digits=6&period=30';

    return {
      secret,
      otpauthUri,
    };
  }

  async enableTwoFactor(
    userId: string,
    code?: string,
  ) {
    const record = await this.prisma.userTwoFactor.findUnique({
      where: { userId },
    });

    if (!record) {
      throw new BadRequestException(
        'start two-factor setup before enabling it',
      );
    }

    if (record.enabled) {
      return { enabled: true };
    }

    const secret = this.decryptTwoFactorSecret(
      record.secretEncrypted,
    );

    if (!code || !this.verifyTotp(secret, code)) {
      throw new BadRequestException(
        'invalid authenticator code',
      );
    }

    await this.prisma.$transaction([
      this.prisma.userTwoFactor.update({
        where: { userId },
        data: {
          enabled: true,
        },
      }),
      this.prisma.notification.create({
        data: {
          userId,
          type:
            NotificationType.RESOURCE_UPDATED,
          entityType: 'user_2fa',
          entityId: userId,
          message:
            'Two-factor authentication was enabled.',
        },
      }),
    ]);

    return { enabled: true };
  }

  async disableTwoFactor(
    userId: string,
    code?: string,
  ) {
    const record = await this.prisma.userTwoFactor.findUnique({
      where: { userId },
    });

    if (!record?.enabled) {
      return { enabled: false };
    }

    const secret = this.decryptTwoFactorSecret(
      record.secretEncrypted,
    );

    if (!code || !this.verifyTotp(secret, code)) {
      throw new BadRequestException(
        'invalid authenticator code',
      );
    }

    await this.prisma.$transaction([
      this.prisma.userTwoFactor.delete({
        where: { userId },
      }),
      this.prisma.notification.create({
        data: {
          userId,
          type:
            NotificationType.RESOURCE_DELETED,
          entityType: 'user_2fa',
          entityId: userId,
          message:
            'Two-factor authentication was disabled.',
        },
      }),
    ]);

    return { enabled: false };
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

  private async createSession(user: {
    id: string;
    username: string;
    email: string;
    role: any;
  }) {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    );

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      requiresTwoFactor: false as const,
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

    return 'scrypt$' + salt + '$' + derived.toString('hex');
  }

  private async verifyPassword(password: string, stored: string) {
    const [algorithm, salt, expectedHex] = stored.split('$');

    if (algorithm !== 'scrypt' || !salt || !expectedHex) {
      return false;
    }

    const expected = Buffer.from(expectedHex, 'hex');
    const actual = await scryptAsync(
      password,
      salt,
      expected.length,
    );

    return (
      actual.length === expected.length &&
      timingSafeEqual(actual, expected)
    );
  }

  private twoFactorEncryptionConfigured() {
    return (
      (process.env.TWO_FACTOR_ENCRYPTION_KEY ?? '')
        .trim().length >= 32
    );
  }

  private requireTwoFactorEncryptionKey() {
    if (!this.twoFactorEncryptionConfigured()) {
      throw new BadRequestException(
        'TWO_FACTOR_ENCRYPTION_KEY must be configured with at least 32 characters before enabling 2FA.',
      );
    }
  }

  private twoFactorEncryptionKey() {
    this.requireTwoFactorEncryptionKey();

    return createHash('sha256')
      .update(
        process.env.TWO_FACTOR_ENCRYPTION_KEY!.trim(),
      )
      .digest();
  }

  private encryptTwoFactorSecret(secret: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv(
      'aes-256-gcm',
      this.twoFactorEncryptionKey(),
      iv,
    );
    const ciphertext = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return [
      'v1',
      iv.toString('base64url'),
      tag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join(':');
  }

  private decryptTwoFactorSecret(payload: string) {
    const [version, ivValue, tagValue, ciphertextValue] =
      payload.split(':');

    if (
      version !== 'v1' ||
      !ivValue ||
      !tagValue ||
      !ciphertextValue
    ) {
      throw new BadRequestException(
        'stored two-factor secret is invalid',
      );
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.twoFactorEncryptionKey(),
      Buffer.from(ivValue, 'base64url'),
    );
    decipher.setAuthTag(
      Buffer.from(tagValue, 'base64url'),
    );

    return Buffer.concat([
      decipher.update(
        Buffer.from(ciphertextValue, 'base64url'),
      ),
      decipher.final(),
    ]).toString('utf8');
  }

  private verifyTotp(secret: string, input: string) {
    const code = input.replace(/\s+/g, '');

    if (!/^\d{6}$/.test(code)) {
      return false;
    }

    const nowStep = Math.floor(Date.now() / 1000 / 30);

    for (let offset = -1; offset <= 1; offset += 1) {
      const expected = this.totpForCounter(
        secret,
        nowStep + offset,
      );

      if (
        timingSafeEqual(
          Buffer.from(code),
          Buffer.from(expected),
        )
      ) {
        return true;
      }
    }

    return false;
  }

  private totpForCounter(
    secret: string,
    counter: number,
  ) {
    const key = this.base32Decode(secret);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(
      BigInt(counter),
      0,
    );

    const digest = createHmac('sha1', key)
      .update(counterBuffer)
      .digest();
    const offset =
      digest[digest.length - 1] & 0x0f;
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      (digest[offset + 1] << 16) |
      (digest[offset + 2] << 8) |
      digest[offset + 3];

    return String(binary % 1_000_000).padStart(
      6,
      '0',
    );
  }

  private base32Encode(buffer: Buffer) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';

    for (const byte of buffer) {
      value = (value << 8) | byte;
      bits += 8;

      while (bits >= 5) {
        output +=
          alphabet[
            (value >>> (bits - 5)) & 31
          ];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output +=
        alphabet[(value << (5 - bits)) & 31];
    }

    return output;
  }

  private base32Decode(value: string) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let current = 0;
    const output: number[] = [];

    for (const character of value
      .replace(/=+$/g, '')
      .toUpperCase()) {
      const index = alphabet.indexOf(character);

      if (index < 0) {
        throw new BadRequestException(
          'stored two-factor secret is invalid',
        );
      }

      current = (current << 5) | index;
      bits += 5;

      if (bits >= 8) {
        output.push(
          (current >>> (bits - 8)) & 0xff,
        );
        bits -= 8;
      }
    }

    return Buffer.from(output);
  }
}
