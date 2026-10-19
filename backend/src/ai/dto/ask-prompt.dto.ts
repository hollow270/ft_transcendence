import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AskPromptDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  prompt!: string;
}
