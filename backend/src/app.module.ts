import { Module } from '@nestjs/common';
import { AiModule } from './ai/ai.module';
import { AppController } from './app.controller';
import { ArtifactsController } from './artifacts/artifacts.controller';
import { ArtifactsService } from './artifacts/artifacts.service';
import { FileValidationService } from './artifacts/file-validation.service';
import { AuthModule } from './auth/auth.module';
import { CommunityController } from './community/community.controller';
import { CommunityService } from './community/community.service';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationsGateway } from './notifications/notifications.gateway';
import { NotificationsService } from './notifications/notifications.service';
import { PrismaModule } from './prisma.module';
import { ScanningModule } from './scanning/scanning.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [PrismaModule, AuthModule, AiModule, UsersModule, ScanningModule],
  controllers: [
    AppController,
    ArtifactsController,
    CommunityController,
    NotificationsController,
  ],
  providers: [
    ArtifactsService,
    FileValidationService,
    CommunityService,
    NotificationsGateway,
    NotificationsService,
  ],
})
export class AppModule {}
