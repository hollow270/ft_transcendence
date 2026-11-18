import { IsIn } from 'class-validator';

export class PutCommentVoteDto
{
	@IsIn( [ -1, 0, 1 ] )
	value!: number;
}
