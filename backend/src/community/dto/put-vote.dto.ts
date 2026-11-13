import { IsIn } from 'class-validator';
import { Verdict } from '@prisma/client';

export class PutVoteDto
{
	@IsIn( [ Verdict.HARMLESS, Verdict.SUSPICIOUS, Verdict.MALICIOUS ] )
	verdict!: Verdict;
}
