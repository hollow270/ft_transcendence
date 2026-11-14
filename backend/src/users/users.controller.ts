import {
  Controller,
  Get,
  Headers,
  Param,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  @Get('me/history')
  async ownHistory(
    @Headers('authorization') authorization?: string,
  ) {
    const user =
      await this.auth.requireUserFromAuthorization(
        authorization,
      );

    return this.users.getOwnHistory(user.id);
  }

  @Get(':userId/community')
  async community(
    @Param('userId') userId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const viewer =
      await this.auth.optionalUserFromAuthorization(authorization);

    return this.users.getCommunityActivity(
      userId,
      viewer?.id ?? null,
    );
  }
}
