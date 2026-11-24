import { IsString, MaxLength } from 'class-validator';

export class PatchCommentDto
{
	@IsString()
	@MaxLength( 4000 )
	body!: string;
}
