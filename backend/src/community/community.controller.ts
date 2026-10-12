import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/auth.guard';
import { CommunityService } from './community.service';

@Controller('artifacts/:artifactId')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get('comments')
  listComments(@Param('artifactId') artifactId: string) {
    return this.community.listComments(artifactId);
  }

  @UseGuards(SessionAuthGuard)
  @Post('comments')
  createComment(
    @Param('artifactId') artifactId: string,
    @Req() request: any,
    @Body() body: { body?: string; parentId?: string },
  ) {
    return this.community.createComment(
      artifactId,
      request.user.id,
      body,
    );
  }

  @UseGuards(SessionAuthGuard)
  @Put('vote')
  vote(
    @Param('artifactId') artifactId: string,
    @Req() request: any,
    @Body('verdict') verdict?: string,
  ) {
    return this.community.vote(
      artifactId,
      request.user.id,
      verdict,
    );
  }

  @Get('votes')
  voteSummary(@Param('artifactId') artifactId: string) {
    return this.community.voteSummary(artifactId);
  }
}
