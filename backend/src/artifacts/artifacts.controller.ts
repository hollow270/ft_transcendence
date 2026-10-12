import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from '../auth/auth.service';
import { ArtifactsService } from './artifacts.service';

@Controller('artifacts')
export class ArtifactsController {
  constructor(
    private readonly artifacts: ArtifactsService,
    private readonly auth: AuthService,
  ) {}

  @Post('files')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        files: 1,
        fileSize: 25 * 1024 * 1024,
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: any,
    @Body('visibility') visibility: string | undefined,
    @Headers('authorization') authorization?: string,
  ) {
    const user =
      await this.auth.optionalUserFromAuthorization(authorization);

    return this.artifacts.submitFile(
      file,
      user?.id ?? null,
      visibility,
    );
  }

  @Get(':artifactId')
  async getArtifact(
    @Param('artifactId') artifactId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const user =
      await this.auth.optionalUserFromAuthorization(authorization);

    return this.artifacts.getArtifact(
      artifactId,
      user?.id ?? null,
    );
  }
}
