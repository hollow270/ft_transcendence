import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min, Max, IsUUID } from 'class-validator';

export class DiscussionQueryDto
{
	@IsOptional()
	@Type( () => Number )
	@IsInt()
	@Min( 1 )
	@Max( 50 )
	limit: number = 20;

	@IsOptional()
	@IsUUID()
	cursor?: string;
}
