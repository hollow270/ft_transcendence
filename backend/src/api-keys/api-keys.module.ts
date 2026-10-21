import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma.module';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { ApiRequestLoggingInterceptor } from './api-request-logging.interceptor';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
  ],
  controllers: [
    ApiKeysController,
  ],
  providers: [
    ApiKeysService,
    ApiKeyGuard,
    ApiRequestLoggingInterceptor,
  ],
  exports: [
    ApiKeysService,
    ApiKeyGuard,
    ApiRequestLoggingInterceptor,
  ],
})
export class ApiKeysModule {}
