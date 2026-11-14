import { Module } from '@nestjs/common';
import { AdminController } from './admin/admin.controller';
import { AdminGuard } from './admin/admin.guard';
import { AdminService } from './admin/admin.service';
import { AiModule } from './ai/ai.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { PublicApiController } from './api-keys/public-api.controller';
import { AppController } from './app.controller';
import { ArtifactsController } from './artifacts/artifacts.controller';
import { ArtifactsService } from './artifacts/artifacts.service';
import { FileValidationService } from './artifacts/file-validation.service';
import { AuthModule } from './auth/auth.module';
import { CommunityController } from './community/community.controller';
import { CommunityService } from './community/community.service';
import { ModerationController } from './moderation/moderation.controller';
import { ModerationService } from './moderation/moderation.service';
import { ModeratorGuard } from './moderation/moderator.guard';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationsGateway } from './notifications/notifications.gateway';
import { NotificationsService } from './notifications/notifications.service';
import { PrismaModule } from './prisma.module';
import { ScanningModule } from './scanning/scanning.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AiModule,
    ApiKeysModule,
    UsersModule,
    ScanningModule,
  ],
  controllers: [
    AppController,
    AdminController,
    ArtifactsController,
    PublicApiController,
    CommunityController,
    ModerationController,
    NotificationsController,
  ],
  providers: [
    AdminService,
    AdminGuard,
    ArtifactsService,
    FileValidationService,
    CommunityService,
    ModerationService,
    ModeratorGuard,
    NotificationsGateway,
    NotificationsService,
  ],
})
export class AppModule {}
