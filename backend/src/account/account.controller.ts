import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../auth/auth.service';
import { AccountService } from './account.service';

@Controller('account')
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly auth: AuthService,
  ) {}

  private session(authorization?: string) {
    return this.auth.requireSessionFromAuthorization(authorization);
  }

  @Get('overview')
  async overview(@Headers('authorization') authorization?: string) {
    const session = await this.session(authorization);
    return this.account.overview(session.userId);
  }

  @Patch('profile')
  async updateProfile(
    @Body() body: { username?: string; email?: string; currentPassword?: string },
    @Headers('authorization') authorization?: string,
  ) {
    const session = await this.session(authorization);
    return this.account.updateProfile(session.userId, body ?? {});
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('password')
  async changePassword(
    @Body() body: { currentPassword?: string; newPassword?: string },
    @Headers('authorization') authorization?: string,
  ) {
    const session = await this.session(authorization);
    return this.account.changePassword(session.userId, session.id, body ?? {});
  }

  @Get('sessions')
  async sessions(@Headers('authorization') authorization?: string) {
    const session = await this.session(authorization);
    return this.account.sessions(session.userId, session.id);
  }

  @Post('sessions/revoke-others')
  async revokeOthers(@Headers('authorization') authorization?: string) {
    const session = await this.session(authorization);
    return this.account.revokeOtherSessions(session.userId, session.id);
  }

  @Delete('sessions/:sessionId')
  async revokeSession(
    @Param('sessionId') sessionId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const session = await this.session(authorization);
    return this.account.revokeSession(session.userId, sessionId, session.id);
  }

  @Post('claims')
  async claim(
    @Body() body: { submissionId?: string; claimToken?: string },
    @Headers('authorization') authorization?: string,
  ) {
    const session = await this.session(authorization);
    return this.account.claim(session.userId, body ?? {});
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('delete')
  async deleteAccount(
    @Body() body: { password?: string; confirm?: string },
    @Headers('authorization') authorization?: string,
  ) {
    const session = await this.session(authorization);
    return this.account.deleteAccount(session.userId, body ?? {});
  }
}
