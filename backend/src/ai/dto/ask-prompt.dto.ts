import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class AskPromptDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  prompt!: string;

  // Optional: when the question is asked from a scan report, the scan it is about.
  @IsOptional()
  @IsUUID()
  scanId?: string;
}
