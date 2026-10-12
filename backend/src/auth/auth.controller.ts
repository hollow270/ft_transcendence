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
import { SessionAuthGuard } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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

  @Post('login')
  login(@Body() body: { email?: string; password?: string }) {
    return this.auth.login(body);
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
