import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
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

  @Get('scanner/capabilities')
  scannerCapabilities() {
    return this.artifacts.scannerCapabilities();
  }

  @Get('search/advanced')
  advancedSearch(
    @Query('q') query?: string,
    @Query('type') type?: string,
    @Query('verdict') verdict?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.artifacts.searchPublicArtifactsAdvanced({
      query,
      type,
      verdict,
      sort,
      page,
      pageSize,
    });
  }

  @Get('search')
  search(@Query('q') query?: string) {
    return this.artifacts.searchPublicArtifacts(query);
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
  async uploadFile(
    @UploadedFile() file: any,
    @Body('visibility') visibility: string | undefined,
    @Body('forceRescan') forceRescan: string | undefined,
    @Headers('authorization') authorization?: string,
  ) {
    const user =
      await this.auth.optionalUserFromAuthorization(authorization);

    return this.artifacts.submitFile(
      file,
      user?.id ?? null,
      visibility,
      forceRescan,
    );
  }

  @Post('urls')
  async submitUrl(
    @Body('url') url: string | undefined,
    @Body('visibility') visibility: string | undefined,
    @Body('forceRescan') forceRescan: boolean | string | undefined,
    @Headers('authorization') authorization?: string,
  ) {
    const user =
      await this.auth.optionalUserFromAuthorization(
        authorization,
      );

    return this.artifacts.submitUrl(
      url,
      user?.id ?? null,
      visibility,
      forceRescan,
    );
  }

  @Get(':artifactId/scans')
  async getArtifactScanHistory(
    @Param('artifactId') artifactId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const user =
      await this.auth.optionalUserFromAuthorization(authorization);

    return this.artifacts.getArtifactScanHistory(
      artifactId,
      user?.id ?? null,
    );
  }

  @Post(':artifactId/rescan')
  async rescanArtifact(
    @Param('artifactId') artifactId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const user =
      await this.auth.requireUserFromAuthorization(authorization);

    return this.artifacts.rescanArtifact(
      artifactId,
      user.id,
    );
  }

  @Post(':artifactId/refresh')
  async refreshArtifactScan(
    @Param('artifactId') artifactId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const user =
      await this.auth.optionalUserFromAuthorization(authorization);

    return this.artifacts.refreshArtifactScan(
      artifactId,
      user?.id ?? null,
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
