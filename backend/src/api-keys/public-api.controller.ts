import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SubmissionSource } from '@prisma/client';
import { ArtifactsService } from '../artifacts/artifacts.service';
import { ApiKeyGuard } from './api-key.guard';
import { ApiRequestLoggingInterceptor } from './api-request-logging.interceptor';

@Controller('api/v1')
@UseGuards(ApiKeyGuard)
@UseInterceptors(
  ApiRequestLoggingInterceptor,
)
export class PublicApiController {
  constructor(
    private readonly artifacts: ArtifactsService,
  ) {}

  @Get('search')
  search(@Query('q') query?: string) {
    return this.artifacts.searchPublicArtifacts(
      query,
    );
  }

  @Get('artifacts/:artifactId')
  async artifact(
    @Req() request: any,
    @Param('artifactId') artifactId: string,
  ) {
    const artifact =
      await this.artifacts.getArtifact(
        artifactId,
        null,
      );

    request.apiArtifactId = artifactId;
    return artifact;
  }

  @Put('artifacts/:artifactId/rescan')
  async rescanArtifact(
    @Req() request: any,
    @Param('artifactId') artifactId: string,
  ) {
    const result =
      await this.artifacts.rescanArtifact(
        artifactId,
        request.apiKeyAuth.userId,
      );

    request.apiArtifactId = artifactId;
    return result;
  }

  @Delete('submissions/:submissionId')
  async deleteSubmission(
    @Req() request: any,
    @Param('submissionId') submissionId: string,
  ) {
    const result =
      await this.artifacts.deleteApiSubmission(
        submissionId,
        request.apiKeyAuth.userId,
      );

    request.apiArtifactId =
      result.artifactId;
    return result;
  }

  @Post('urls')
  async submitUrl(
    @Req() request: any,
    @Body('url') url?: string,
    @Body('forceRescan')
    forceRescan?: boolean | string,
  ) {
    const result =
      await this.artifacts.submitUrl(
        url,
        request.apiKeyAuth.userId,
        'PUBLIC',
        forceRescan,
        SubmissionSource.API,
      );

    request.apiArtifactId =
      result.artifact.id;

    return result;
  }

  @Post('files')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        files: 1,
        fileSize: 25 * 1024 * 1024,
      },
    }),
  )
  async submitFile(
    @Req() request: any,
    @UploadedFile() file: any,
    @Body('forceRescan')
    forceRescan?: string,
  ) {
    const result =
      await this.artifacts.submitFile(
        file,
        request.apiKeyAuth.userId,
        'PUBLIC',
        forceRescan,
        SubmissionSource.API,
      );

    request.apiArtifactId =
      result.artifact.id;

    return result;
  }
}
