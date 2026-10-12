import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ArtifactsController } from './artifacts/artifacts.controller';
import { ArtifactsService } from './artifacts/artifacts.service';
import { AuthController } from './auth/auth.controller';
import { SessionAuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { CommunityController } from './community/community.controller';
import { CommunityService } from './community/community.service';
import { PrismaService } from './prisma.service';

@Module({
  controllers: [
    AppController,
    AuthController,
    ArtifactsController,
    CommunityController,
  ],
  providers: [
    PrismaService,
    AuthService,
    SessionAuthGuard,
    ArtifactsService,
    CommunityService,
  ],
})
export class AppModule {}
