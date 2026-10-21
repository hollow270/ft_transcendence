import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ArtifactsController } from './artifacts/artifacts.controller';
import { ArtifactsService } from './artifacts/artifacts.service';
import { AuthController } from './auth/auth.controller';
import { SessionAuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { CommunityController } from './community/community.controller';
import { CommunityService } from './community/community.service';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationsGateway } from './notifications/notifications.gateway';
import { NotificationsService } from './notifications/notifications.service';
import { PrismaService } from './prisma.service';

@Module({
  controllers: [
    AppController,
    AuthController,
    ArtifactsController,
    CommunityController,
    NotificationsController,
  ],
  providers: [
    PrismaService,
    AuthService,
    SessionAuthGuard,
    ArtifactsService,
    CommunityService,
    NotificationsGateway,
    NotificationsService,
  ],
})
export class AppModule {}
