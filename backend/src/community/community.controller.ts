import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards, Query, BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/auth.guard';
import { CommunityService } from './community.service';
import { DiscussionQueryDto } from './dto/discussion-query.dto';
import { PostCommentDto } from './dto/post-comment.dto';
import { PatchCommentDto } from './dto/patch-comment.dto';
import { PostReportDto } from './dto/post-report.dto';
import { PutVoteDto } from './dto/put-vote.dto';

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

	@Get( 'comments/:commentId/replies' )
	getReplies( @Param( 'artifactId', ParseUUIDPipe ) artifactId: string,
		@Param( 'commentId', ParseUUIDPipe ) commentId: string,
		@Query() query: DiscussionQueryDto )
	{
		return ( this.community.getReplies( artifactId, commentId, query.limit, query.cursor ) );
	}

	@UseGuards(SessionAuthGuard)
	@Post('comments')
	createComment( @Param( 'artifactId', ParseUUIDPipe ) artifactId: string,
		@Req() request: any,
		@Body() query: PostCommentDto )
	{
		const	body = { body: query.body, parentId: query.parentId };
		return this.community.createComment( artifactId, request.user.id, body );
	}

	@UseGuards(SessionAuthGuard)
	@Patch('comments/:commentId')
	editComment( @Param( 'artifactId', ParseUUIDPipe ) artifactId: string,
		@Param( 'commentId', ParseUUIDPipe ) commentId: string,
		@Req() request: any,
		@Body() query: PatchCommentDto )
	{
		return this.community.editComment( artifactId, commentId, request.user.id, query.body );
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
		@Body() query: PostReportDto
	)
	{
		const	body = { reason: query.reason, details: query.details };
		return this.community.reportComment( artifactId, commentId, request.user.id, body );
	}

	@UseGuards(SessionAuthGuard)
	@Put('vote')
	vote( @Param( 'artifactId', ParseUUIDPipe ) artifactId: string,
		@Req() request: any,
		@Body() query: PutVoteDto
	)
	{
		return this.community.vote( artifactId, request.user.id, query.verdict );
	}

	@Get('votes')
	voteSummary(@Param( 'artifactId', ParseUUIDPipe ) artifactId: string)
	{
		return this.community.voteSummary(artifactId);
	}
}
