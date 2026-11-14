import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ExplainScanDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  scanId!: string;
}
