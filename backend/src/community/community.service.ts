import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CommentStatus,
  NotificationType,
  Prisma,
  ReportReason,
  UserStatus,
  Verdict,
  Visibility,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma.service';

const	VISIBLE_COMMENTS = {
	OR: [
		{
			status: CommentStatus.ACTIVE
		},
		{
			replies: {
				some: {
					status: CommentStatus.ACTIVE
				}
			}
		}
	]
};

const	COMMENT_FIELDS = {
	id: true,
	parentId: true,
	status: true,
	body: true,
	createdAt: true,
	editedAt: true,
	user: {
		select: {
			id: true,
			username: true,
			role: true
		}
	},
	_count: {
		select: {
			replies: {
				where: {
					...VISIBLE_COMMENTS
				}
			}
		}
	}
};

@Injectable()
export class CommunityService
{
	constructor( private readonly prisma: PrismaService, private readonly notifications: NotificationsService, ) {}

	async listComments( artifactId: string, limit?: number, offset?: number ) {

		await this.ensurePublicArtifact(artifactId);

		return this.prisma.comment.findMany({
			where: {
				artifactId,
				status: CommentStatus.ACTIVE,
			},
			orderBy: [
				{ createdAt: 'asc' },
				{ id: 'asc' }
			],
			select: {
				id: true,
				parentId: true,
				body: true,
				createdAt: true,
				editedAt: true,
				user: {
					select: {
						id: true,
						username: true,
						role: true,
					},
				},
			},
			take: limit,
			skip: offset,
		});
	}

	async getDiscussion( artifactId: string, limit: number, cursor?: string )
	{
		await this.ensurePublicArtifact(artifactId);

		const	[rows, totalCount] = await Promise.all( [ this.prisma.comment.findMany(
			{
				where: {
					artifactId,
					parentId: null,
					...VISIBLE_COMMENTS
				},
				orderBy: [
					{ createdAt: 'desc' },
					{ id: 'desc' }
				],
				take: limit + 1,
				cursor: cursor ? { id: cursor } : undefined,
				skip: cursor ? 1 : 0,
				select: {
					...COMMENT_FIELDS,
					replies: {
						where: {
							...VISIBLE_COMMENTS
						},
						orderBy: [
							{ createdAt: 'asc' },
							{ id: 'asc' }
						],
						take: 3,
						select: COMMENT_FIELDS
					}
				}
			}
		), this.prisma.comment.count(
			{
				where: {
					artifactId,
					status: CommentStatus.ACTIVE
				}
			}
		) ] );

		const	hasMore = rows.length > limit;
		const	items = hasMore ? rows.slice( 0, limit ) : rows;

		let		maskedItems = items.map( mask );
		for ( let i = 0; i < maskedItems.length; i++ ) {
			maskedItems[i].replies = maskedItems[i].replies.map( mask );
		}

		const	nextCursor = hasMore ? items[items.length - 1].id : null;

		return { totalCount, items: maskedItems, nextCursor };
	}

	async getReplies( artifactId: string, commentId: string, limit: number, cursor?: string )
	{
		await this.ensurePublicArtifact( artifactId );

		const	rows= await this.prisma.comment.findMany(
			{
				where: {
					artifactId,
					parentId: commentId,
					...VISIBLE_COMMENTS
				},
				orderBy: [
					{ createdAt: 'asc' },
					{ id: 'asc' }
				],
				take: limit + 1,
				cursor: cursor ? { id: cursor } : undefined,
				skip: cursor ? 1 : 0,
				select: COMMENT_FIELDS
			}
		);

		const	hasMore = rows.length > limit;
		const	items = hasMore ? rows.slice( 0, limit ) : rows;
		const	maskedItems = items.map( mask );
		const	nextCursor = hasMore ? items[items.length - 1].id : null;

		return ( { items: maskedItems, nextCursor } );
	}

	async createComment( artifactId: string, userId: string, input: { body: string; parentId?: string }, )
	{
		await this.ensurePublicArtifact(artifactId);
		await this.assertCanComment( userId );

		const body = input.body.trim();

		if ( !body ) {
			throw new BadRequestException( 'comment body must contain between 1 and 4000 characters', );
		}

		const parent = input.parentId ? await this.prisma.comment.findFirst	(
			{ 
				where: {
					id: input.parentId,
					artifactId,
					status: CommentStatus.ACTIVE,
				},
				select: {
					id: true,
					userId: true,
				},
			}
		) : null;

		if ( input.parentId && !parent ) {
			throw new BadRequestException( 'parent comment nonexistent' );
		}

		const comment =
		await this.prisma.comment.create(
			{
				data: {
					artifactId,
					userId,
					parentId: input.parentId ?? null,
					body,
				},
				select: {
					id: true,
					artifactId: true,
					parentId: true,
					body: true,
					createdAt: true,
					user: {
						select: {
							id: true,
							username: true,
						},
					},
				},
			}
		);

		await this.notifications.createResourceEvent(
			{
				userId,
				type: NotificationType.RESOURCE_CREATED,
				entityType: 'comment',
				entityId: comment.id,
				artifactId,
				commentId: comment.id,
				message: 'Your comment was created.',
			}
		);

		if (parent) {
			await this.notifications.createCommentReply(
				{
					recipientUserId: parent.userId,
					actorUserId: userId,
					artifactId,
					commentId: comment.id,
				}
			);
		}

		return ( comment );
	}

	async editComment( artifactId: string, commentId: string, userId: string, bodyInput: string, )
	{
		await this.ensurePublicArtifact(artifactId);
		await this.assertCanComment( userId );

		const body = bodyInput.trim();

		if ( !body ) {
			throw new BadRequestException( 'comment body must contain between 1 and 4000 characters', );
		}

		const comment = await this.prisma.comment.findFirst(
			{
				where: {
					id: commentId,
					artifactId,
					userId,
					status: CommentStatus.ACTIVE,
				},
			}
		);

		if (!comment) {
			throw new NotFoundException( 'comment not found or not editable by this user', );
		}

		const updated = await this.prisma.comment.update(
			{
				where: {
					id: comment.id,
				},
				data: {
					body,
					editedAt: new Date(),
				},
				select: {
					id: true,
					parentId: true,
					body: true,
					createdAt: true,
					editedAt: true,
					user: {
						select: {
							id: true,
							username: true,
							role: true,
						},
					},
				},
			}
		);

		await this.notifications.createResourceEvent(
			{
				userId,
				type: NotificationType.RESOURCE_UPDATED,
				entityType: 'comment',
				entityId: comment.id,
				artifactId,
				commentId: comment.id,
				message: 'Your comment was updated.',
			}
		);

		return updated;
	}

	async deleteComment( artifactId: string, commentId: string, userId: string, )
	{
		await this.ensurePublicArtifact(artifactId);

		const comment = await this.prisma.comment.findFirst(
			{
				where: {
					id: commentId,
					artifactId,
					userId,
					status: CommentStatus.ACTIVE,
				},
			}
		);

		if (!comment) {
			throw new NotFoundException( 'comment not found or not deletable by this user', );
		}

		await this.prisma.comment.update(
			{
				where: {
					id: comment.id,
				},
				data: {
					status: CommentStatus.DELETED,
					body: '[deleted]',
					deletedAt: new Date(),
				},
			}
		);

		await this.notifications.createResourceEvent(
			{
				userId,
				type: NotificationType.RESOURCE_DELETED,
				entityType: 'comment',
				entityId: comment.id,
				artifactId,
				commentId: comment.id,
				message: 'Your comment was deleted.',
			}
		);

		return { success: true, };
	}

	async reportComment( artifactId: string, commentId: string, reporterId: string, input: { reason: ReportReason; details?: string; }, )
	{
		await this.ensurePublicArtifact(artifactId);

		const comment =
			await this.prisma.comment.findFirst(
				{
					where: {
						id: commentId,
						artifactId,
						status: CommentStatus.ACTIVE,
					},
					select: {
						id: true,
						userId: true,
					},
				}
			)
		;

		if (!comment) {
			throw new NotFoundException( 'comment not found', );
		}

		if (comment.userId === reporterId) {
			throw new BadRequestException( 'you cannot report your own comment', );
		}

		const details = input.details?.trim() || null;

		if ( details && details.length > 2000 ) {
			throw new BadRequestException( 'report details must contain at most 2000 characters', );
		}

		try {
			return await this.prisma.commentReport.create(
				{
					data: {
						commentId: comment.id,
						reporterId,
						reason: input.reason,
						details,
					},
					select: {
						id: true,
						commentId: true,
						reason: true,
						details: true,
						status: true,
						createdAt: true,
					},
				}
			);
		} catch (error) {
			if ( error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' ) {
				throw new BadRequestException( 'you already reported this comment', );
			}

			throw error;
		}
	}

	async vote( artifactId: string, userId: string, verdictInput: Verdict, )
	{
		await this.ensurePublicArtifact(artifactId);

		const previousVote =
		await this.prisma.communityVote.findUnique({
			where: {
			artifactId_userId: {
				artifactId,
				userId,
			},
			},
			select: {
			verdict: true,
			},
		});

		const vote = await this.prisma.communityVote.upsert({
		where: {
			artifactId_userId: {
			artifactId,
			userId,
			},
		},
		update: {
			verdict: verdictInput,
		},
		create: {
			artifactId,
			userId,
			verdict: verdictInput,
		},
		});

		await this.notifications.createResourceEvent({
		userId,
		type: previousVote
			? NotificationType.RESOURCE_UPDATED
			: NotificationType.RESOURCE_CREATED,
		entityType: 'community_vote',
		entityId:
			artifactId + ':' + userId,
		artifactId,
		message: previousVote
			? 'Your community verdict was updated.'
			: 'Your community verdict was created.',
		metadata: {
			verdict: vote.verdict,
		},
		});

		return {
		artifactId: vote.artifactId,
		userId: vote.userId,
		verdict: vote.verdict,
		updatedAt: vote.updatedAt,
		};
	}

  async voteSummary(artifactId: string) {
    await this.ensurePublicArtifact(artifactId);

    const groups = await this.prisma.communityVote.groupBy({
      by: ['verdict'],
      where: { artifactId },
      _count: {
        verdict: true,
      },
    });

    return {
      artifactId,
      counts: {
        HARMLESS:
          groups.find((group) => group.verdict === Verdict.HARMLESS)
            ?._count.verdict ?? 0,
        SUSPICIOUS:
          groups.find((group) => group.verdict === Verdict.SUSPICIOUS)
            ?._count.verdict ?? 0,
        MALICIOUS:
          groups.find((group) => group.verdict === Verdict.MALICIOUS)
            ?._count.verdict ?? 0,
      },
    };
  }

  private async ensurePublicArtifact(artifactId: string) {
    const publicSubmission = await this.prisma.submission.findFirst({
      where: {
        artifactId,
        visibility: Visibility.PUBLIC,
      },
      select: { id: true },
    });

    if (!publicSubmission) {
      throw new NotFoundException('public artifact not found');
    }
  }

	private async assertCanComment( userId: string )
	{
		const	user = await this.prisma.user.findUnique(
			{
				where: {
					id: userId,
				},
				select: {
					id: true,
					status: true,
					commentBannedUntil: true,
				}
			}
		);

		if ( !user || user.status !== UserStatus.ACTIVE ) {
			throw new ForbiddenException( 'user cannot comment' );
		}

		if ( user.commentBannedUntil && user.commentBannedUntil > new Date() ) {
			throw new ForbiddenException( 'user is banned from comment services' );
		}
	}
}

function mask<T extends { status: CommentStatus }>( comment: T )
{
	return ( comment.status === CommentStatus.ACTIVE ? comment : { ...comment, body: null, user: null } );
}

