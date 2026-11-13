import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReportReason } from '@prisma/client';

export class PostReportDto
{
	@IsEnum( ReportReason )
	reason!: ReportReason;

	@IsOptional()
	@IsString()
	@MaxLength( 2000 )
	details?: string;
}
