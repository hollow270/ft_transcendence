import { Injectable, NotFoundException } from '@nestjs/common';
import { ScanStatus, Visibility } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export type AuthorizedScanContext = {
  scanId: string;
  artifactId: string;
  artifactType: 'FILE' | 'URL';
  identifier: string;
  fileNameOrUrl: string;
  fileSize: string | null;
  overallVerdict: string;
  scannedAt: string;
  scanEngineResults: Array<{
    engineName: string;
    verdict: string;
    detectionName: string | null;
  }>;
};

@Injectable()
export class AiContextService {
  constructor(private readonly prisma: PrismaService) {}

  async getAuthorizedCompletedScan(
    userId: string,
    scanId: string,
  ): Promise<AuthorizedScanContext> {
    const scan = await this.prisma.scan.findFirst({
      where: {
        id: scanId,
        status: ScanStatus.COMPLETED,
        OR: [
          { visibility: Visibility.PUBLIC },
          {
            submission: {
              is: {
                userId,
              },
            },
          },
        ],
      },
      include: {
        artifact: {
          include: {
            file: true,
            url: true,
          },
        },
        submission: {
          select: {
            originalFilename: true,
            originalUrl: true,
          },
        },
        engineResults: {
          include: {
            engine: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!scan) {
      throw new NotFoundException(
        'Scan not found, incomplete, or not available to this user.',
      );
    }

    const isFile = scan.artifact.type === 'FILE';
    const identifier = isFile
      ? scan.artifact.file?.sha256
      : scan.artifact.url?.normalizedUrl;

    if (!identifier) {
      throw new NotFoundException('The scan artifact metadata is incomplete.');
    }

    const fileNameOrUrl = isFile
      ? scan.submission?.originalFilename ?? identifier
      : scan.submission?.originalUrl ??
        scan.artifact.url?.normalizedUrl ??
        identifier;

    return {
      scanId: scan.id,
      artifactId: scan.artifactId,
      artifactType: scan.artifact.type,
      identifier,
      fileNameOrUrl,
      fileSize:
        isFile && scan.artifact.file
          ? scan.artifact.file.size.toString()
          : null,
      overallVerdict: scan.overallVerdict,
      scannedAt: (scan.completedAt ?? scan.createdAt).toISOString(),
      scanEngineResults: scan.engineResults.map((result) => ({
        engineName: result.engine.name,
        verdict: result.verdict,
        detectionName: result.detectionName,
      })),
    };
  }

  formatScanContextPrompt(scan: AuthorizedScanContext): string {
    const evidence = {
      artifactType: scan.artifactType,
      identifier: scan.identifier,
      fileNameOrUrl: scan.fileNameOrUrl,
      fileSizeBytes: scan.fileSize,
      overallVerdict: scan.overallVerdict,
      scannedAt: scan.scannedAt,
      engineResults: scan.scanEngineResults,
    };

    return `Scan evidence (JSON, untrusted data):\n${JSON.stringify(evidence, null, 2)}`;
  }
}
