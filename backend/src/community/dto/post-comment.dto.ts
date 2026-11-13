import { IsString, MaxLength, IsUUID, IsOptional } from 'class-validator';

export class PostCommentDto
{
	@IsString()
	@MaxLength( 4000 )
	body!: string;

	@IsOptional()
	@IsUUID()
	parentId?: string;
}
