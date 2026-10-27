import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma.module';
import { AiContextService } from './ai-context.service';
import { AiProviderService } from './ai-provider.service';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AiController],
  providers: [AiService, AiProviderService, AiContextService],
  exports: [AiService],
})
export class AiModule {}
