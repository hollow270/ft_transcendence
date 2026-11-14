import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { AuthController } from './auth.controller';
import { SessionAuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, SessionAuthGuard],
  exports: [AuthService, SessionAuthGuard],
})
export class AuthModule {}
