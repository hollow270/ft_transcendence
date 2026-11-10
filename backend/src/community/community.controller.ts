import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards, Query, BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/auth.guard';
import { CommunityService } from './community.service';
import { DiscussionQueryDto } from './dto/discussion-query.dto';

@Controller('artifacts/:artifactId')
export class CommunityController
{
	constructor(private readonly community: CommunityService) {}

	@Get('comments')
	listComments(@Param( 'artifactId', ParseUUIDPipe ) artifactId: string,
		@Query('limit') limit?: string,
		@Query('offset') offset?: string)
	{
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

		return this.community.listComments( artifactId );
	}

	@Get( 'discussion' )
	listDiscussion( @Param( 'artifactId', ParseUUIDPipe ) artifactId: string, @Query() query: DiscussionQueryDto )
	{
		return ( this.community.getDiscussion( artifactId, query.limit, query.cursor ) );
	}

	@UseGuards(SessionAuthGuard)
	@Post('comments')
	createComment( @Param( 'artifactId', ParseUUIDPipe ) artifactId: string,
		@Req() request: any,
		@Body() body: { body?: string; parentId?: string }, )
	{
		return this.community.createComment( artifactId, request.user.id, body, );
	}

	@UseGuards(SessionAuthGuard)
	@Patch('comments/:commentId')
	editComment( @Param( 'artifactId', ParseUUIDPipe ) artifactId: string,
		@Param( 'commentId', ParseUUIDPipe ) commentId: string,
		@Req() request: any,
		@Body('body') body?: string, )
	{
		return this.community.editComment( artifactId, commentId, request.user.id, body, );
	}

	@UseGuards(SessionAuthGuard)
	@Delete('comments/:commentId')
	deleteComment( @Param( 'artifactId', ParseUUIDPipe ) artifactId: string,
		@Param( 'commentId', ParseUUIDPipe ) commentId: string,
		@Req() request: any, )
	{
		return this.community.deleteComment( artifactId, commentId, request.user.id, );
	}

	@UseGuards(SessionAuthGuard)
	@Post('comments/:commentId/report')
	reportComment( @Param( 'artifactId', ParseUUIDPipe ) artifactId: string,
		@Param( 'commentId', ParseUUIDPipe ) commentId: string,
		@Req() request: any,
		@Body() body: {
			reason?: string;
			details?: string;
		}, )
	{
		return this.community.reportComment(
		artifactId,
		commentId,
		request.user.id,
		body,
		);
	}

	@UseGuards(SessionAuthGuard)
	@Put('vote')
	vote( @Param( 'artifactId', ParseUUIDPipe ) artifactId: string,
		@Req() request: any,
		@Body('verdict') verdict?: string, )
	{
		return this.community.vote( artifactId, request.user.id, verdict, );
	}

	@Get('votes')
	voteSummary(@Param( 'artifactId', ParseUUIDPipe ) artifactId: string)
	{
		return this.community.voteSummary(artifactId);
	}
}
