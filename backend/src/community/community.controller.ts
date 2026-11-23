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
import { Query, BadRequestException } from '@nestjs/common';

@Controller('artifacts/:artifactId')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

	@Get('comments')
	listComments(@Param('artifactId') artifactId: string,
				@Query('limit') limit?: string,
				@Query('offset') offset?: string) {

		if ( limit !== undefined ) {

			const	nLimit = Number( limit );
			if ( !Number.isInteger( nLimit ) )
				throw new BadRequestException( 'bad request params' );

			if ( nLimit < 1 || nLimit > 100 )
				throw new BadRequestException( 'bad request params' );

			if ( offset === undefined )
				return ( this.community.listComments( artifactId, nLimit ) );

			const	nOffset = Number( offset );
			if ( !Number.isInteger( nOffset ) )
				throw new BadRequestException( 'bad request params' );

			if ( nOffset < 0 )
				throw new BadRequestException( 'bad request params' );

			return ( this.community.listComments( artifactId, nLimit, nOffset ) );
		}
		else if ( offset !== undefined )
			throw new BadRequestException( 'bad request params' );

		// const	nLimit = Number( limit );
		// const	nOffset = Number( offset );
		//
		// if ( !Number.isInteger( nLimit ) || !Number.isInteger( nOffset ) )
		// 	throw new BadRequestException( 'bad request params' );
		//
		// if ( nLimit < 1 || nLimit > 100 || nOffset < 0 )
		// 	throw new BadRequestException( 'bad request params' );
		
		return this.community.listComments( artifactId );
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
