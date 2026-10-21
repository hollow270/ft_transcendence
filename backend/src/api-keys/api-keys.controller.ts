import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/auth.guard';
import { ApiKeysService } from './api-keys.service';

@Controller('api-keys')
@UseGuards(SessionAuthGuard)
export class ApiKeysController {
  constructor(
    private readonly apiKeys: ApiKeysService,
  ) {}

  @Get()
  list(@Req() request: any) {
    return this.apiKeys.list(
      request.user.id,
    );
  }

  @Post()
  create(
    @Req() request: any,
    @Body('name') name?: string,
  ) {
    return this.apiKeys.create(
      request.user.id,
      name,
    );
  }

  @Delete(':apiKeyId')
  revoke(
    @Req() request: any,
    @Param('apiKeyId') apiKeyId: string,
  ) {
    return this.apiKeys.revoke(
      request.user.id,
      apiKeyId,
    );
  }
}
