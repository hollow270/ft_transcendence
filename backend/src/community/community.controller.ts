import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
  @Patch('comments/:commentId')
  editComment(
    @Param('artifactId') artifactId: string,
    @Param('commentId') commentId: string,
    @Req() request: any,
    @Body('body') body?: string,
  ) {
    return this.community.editComment(
      artifactId,
      commentId,
      request.user.id,
      body,
    );
  }

  @UseGuards(SessionAuthGuard)
  @Delete('comments/:commentId')
  deleteComment(
    @Param('artifactId') artifactId: string,
    @Param('commentId') commentId: string,
    @Req() request: any,
  ) {
    return this.community.deleteComment(
      artifactId,
      commentId,
      request.user.id,
    );
  }

  @UseGuards(SessionAuthGuard)
  @Post('comments/:commentId/report')
  reportComment(
    @Param('artifactId') artifactId: string,
    @Param('commentId') commentId: string,
    @Req() request: any,
    @Body()
    body: {
      reason?: string;
      details?: string;
    },
  ) {
    return this.community.reportComment(
      artifactId,
      commentId,
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
