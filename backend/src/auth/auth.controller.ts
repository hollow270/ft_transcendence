import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Throttle } from '@nestjs/throttler';
import { SessionAuthGuard } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle({
    default: {
      limit: 10,
      ttl: 60_000,
    },
  })
  @Post('register')
  register(
    @Body()
    body: {
      username?: string;
      email?: string;
      password?: string;
    },
  ) {
    return this.auth.register(body);
  }

  @Throttle({
    default: {
      limit: 10,
      ttl: 60_000,
    },
  })
  @Post('login')
  login(
    @Body()
    body: {
      email?: string;
      password?: string;
      totpCode?: string;
    },
  ) {
    return this.auth.login(body);
  }

  @UseGuards(SessionAuthGuard)
  @Get('2fa/status')
  twoFactorStatus(@Req() request: any) {
    return this.auth.twoFactorStatus(request.user.id);
  }

  @UseGuards(SessionAuthGuard)
  @Post('2fa/setup')
  setupTwoFactor(@Req() request: any) {
    return this.auth.setupTwoFactor(request.user.id);
  }

  @UseGuards(SessionAuthGuard)
  @Post('2fa/enable')
  enableTwoFactor(
    @Req() request: any,
    @Body('code') code?: string,
  ) {
    return this.auth.enableTwoFactor(
      request.user.id,
      code,
    );
  }

  @UseGuards(SessionAuthGuard)
  @Post('2fa/disable')
  disableTwoFactor(
    @Req() request: any,
    @Body('code') code?: string,
  ) {
    return this.auth.disableTwoFactor(
      request.user.id,
      code,
    );
  }

  @UseGuards(SessionAuthGuard)
  @Post('logout')
  async logout(@Headers('authorization') authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      return { success: false };
    }

    return this.auth.logout(token);
  }

  @UseGuards(SessionAuthGuard)
  @Get('me')
  me(@Req() request: any) {
    const { id, username, email, role, status } = request.user;

    return { id, username, email, role, status };
  }
}
