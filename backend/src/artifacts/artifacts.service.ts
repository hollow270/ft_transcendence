import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ArtifactType,
  Prisma,
  ScanReason,
  ScanStatus,
  Verdict,
  Visibility,
} from '@prisma/client';
import { createHash } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma.service';
import { ScanningService } from '../scanning/scanning.service';
import {
  ScannerCompletedResult,
  ScannerFile,
  ScannerResult,
} from '../scanning/scanning.types';
import { FileValidationService } from './file-validation.service';

@Injectable()
export class ArtifactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly scanning: ScanningService,
    private readonly fileValidation: FileValidationService,
  ) {}

  scannerCapabilities() {
    return this.scanning.getCapabilities();
  }

  async submitFile(
    uploadedFile: ScannerFile | undefined,
    userId: string | null,
    visibilityInput?: string,
    forceRescanInput?: string,
  ) {
    const file = this.fileValidation.validate(uploadedFile);
    const visibility = this.parseVisibility(visibilityInput, userId);
    const forceRescan =
      (forceRescanInput ?? 'false').toLowerCase() === 'true';

    const sha256 = createHash('sha256')
      .update(file.buffer)
      .digest('hex');
    const sha1 = createHash('sha1')
      .update(file.buffer)
      .digest('hex');
    const md5 = createHash('md5')
      .update(file.buffer)
      .digest('hex');

    const artifact = await this.findOrCreateFileArtifact({
      sha256,
      sha1,
      md5,
      size: file.size,
      mimeType:
        file.mimetype || 'application/octet-stream',
    });

    await this.prisma.artifact.update({
      where: { id: artifact.id },
      data: { lastSeenAt: new Date() },
    });

    const submission =
      await this.prisma.submission.create({
        data: {
          artifactId: artifact.id,
          userId,
          visibility,
          originalFilename: file.originalname,
          binaryDeleteDeadline: new Date(
            Date.now() + 24 * 60 * 60 * 1000,
          ),
        },
      });

    const reusableScan = forceRescan
      ? null
      : await this.findReusableScan(
          artifact.id,
          visibility,
          userId,
        );

    if (reusableScan) {
      await this.prisma.submission.update({
        where: { id: submission.id },
        data: {
          binaryDeletedAt: new Date(),
        },
      });

      return {
        artifact: this.formatFileArtifact(artifact),
        submission: {
          id: submission.id,
          visibility: submission.visibility,
          originalFilename:
            submission.originalFilename,
          createdAt: submission.createdAt,
        },
        scan: this.formatScan(reusableScan),
        reusedScan: true,
      };
    }

    const previousCompletedScan =
      await this.prisma.scan.findFirst({
        where: {
          artifactId: artifact.id,
          status: ScanStatus.COMPLETED,
        },
        select: {
          id: true,
        },
      });

    const reason = forceRescan
      ? ScanReason.MANUAL_RESCAN
      : previousCompletedScan
        ? ScanReason.STALE_RESCAN
        : ScanReason.INITIAL;

    const scan = await this.createAndRunFileScan({
      artifactId: artifact.id,
      submissionId: submission.id,
      userId,
      visibility,
      reason,
      file,
      sha256,
      forceRescan,
    });

    return {
      artifact: this.formatFileArtifact(artifact),
      submission: {
        id: submission.id,
        visibility: submission.visibility,
        originalFilename:
          submission.originalFilename,
        createdAt: submission.createdAt,
      },
      scan: this.formatScan(scan),
      reusedScan: false,
    };
  }

  async getArtifact(
    artifactId: string,
    userId: string | null,
  ) {
    const allowedSubmission =
      await this.prisma.submission.findFirst({
        where: {
          artifactId,
          OR: [
            { visibility: Visibility.PUBLIC },
            ...(userId ? [{ userId }] : []),
          ],
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          userId: true,
          visibility: true,
          originalFilename: true,
          originalUrl: true,
          createdAt: true,
        },
      });

    if (!allowedSubmission) {
      throw new NotFoundException(
        'artifact not found',
      );
    }

    const artifact =
      await this.prisma.artifact.findUnique({
        where: {
          id: artifactId,
        },
        include: {
          file: true,
          url: true,
        },
      });

    if (!artifact) {
      throw new NotFoundException(
        'artifact not found',
      );
    }

    const scan = await this.findLatestAccessibleScan(
      artifactId,
      userId,
    );

    return {
      id: artifact.id,
      type: artifact.type,
      firstSeenAt: artifact.firstSeenAt,
      lastSeenAt: artifact.lastSeenAt,
      file: artifact.file
        ? {
            sha256: artifact.file.sha256,
            sha1: artifact.file.sha1,
            md5: artifact.file.md5,
            size: artifact.file.size.toString(),
            mimeType: artifact.file.mimeType,
          }
        : null,
      url: artifact.url
        ? {
            normalizedUrl:
              artifact.url.normalizedUrl,
            domain: artifact.url.domain,
          }
        : null,
      latestScan: scan
        ? this.formatScan(scan)
        : null,
    };
  }

  async rescanArtifact(
    artifactId: string,
    userId: string,
  ) {
    const artifact =
      await this.prisma.artifact.findUnique({
        where: {
          id: artifactId,
        },
        include: {
          file: true,
        },
      });

    if (!artifact?.file) {
      throw new NotFoundException(
        'file artifact not found',
      );
    }

    const submission =
      await this.prisma.submission.findFirst({
        where: {
          artifactId,
          userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

    if (!submission) {
      throw new BadRequestException(
        'Rescan requires one of your own submissions for this artifact.',
      );
    }

    const scan = await this.prisma.scan.create({
      data: {
        artifactId,
        submissionId: submission.id,
        visibility: submission.visibility,
        status: ScanStatus.RUNNING,
        reason: ScanReason.MANUAL_RESCAN,
        startedAt: new Date(),
        provider: this.scanning.providerName,
      },
    });

    try {
      const result =
        await this.scanning.rescanFile({
          sha256: artifact.file.sha256,
          visibility: submission.visibility,
        });

      const persisted =
        await this.applyScannerResult(
          scan.id,
          result,
        );

      await this.notifyIfCompleted(
        persisted,
        userId,
        artifactId,
      );

      return this.formatScan(persisted);
    } catch (error) {
      await this.failScan(scan.id, error);
      throw error;
    }
  }

  async refreshArtifactScan(
    artifactId: string,
    userId: string | null,
  ) {
    const scan =
      await this.prisma.scan.findFirst({
        where: {
          artifactId,
          status: ScanStatus.RUNNING,
          provider: {
            not: null,
          },
          providerAnalysisId: {
            not: null,
          },
          OR: [
            { visibility: Visibility.PUBLIC },
            ...(userId
              ? [
                  {
                    submission: {
                      is: {
                        userId,
                      },
                    },
                  },
                ]
              : []),
          ],
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          submission: {
            select: {
              userId: true,
            },
          },
          engineResults: {
            include: {
              engine: true,
            },
          },
        },
      });

    if (!scan) {
      const latest =
        await this.findLatestAccessibleScan(
          artifactId,
          userId,
        );

      if (!latest) {
        throw new NotFoundException(
          'scan not found',
        );
      }

      return this.formatScan(latest);
    }

    if (
      scan.providerCheckedAt &&
      Date.now() -
        scan.providerCheckedAt.getTime() <
        Number(
          process.env.SCANNER_REFRESH_COOLDOWN_MS ??
            60000,
        )
    ) {
      return this.formatScan(scan);
    }

    const result = await this.scanning.poll(
      scan.provider!,
      scan.providerAnalysisId!,
    );

    const persisted =
      await this.applyScannerResult(
        scan.id,
        result,
      );

    await this.notifyIfCompleted(
      persisted,
      scan.submission?.userId ?? null,
      artifactId,
    );

    return this.formatScan(persisted);
  }

  private async createAndRunFileScan(input: {
    artifactId: string;
    submissionId: string;
    userId: string | null;
    visibility: Visibility;
    reason: ScanReason;
    file: ScannerFile;
    sha256: string;
    forceRescan: boolean;
  }) {
    const scan = await this.prisma.scan.create({
      data: {
        artifactId: input.artifactId,
        submissionId: input.submissionId,
        visibility: input.visibility,
        status: ScanStatus.RUNNING,
        reason: input.reason,
        startedAt: new Date(),
        provider: this.scanning.providerName,
      },
    });

    try {
      const result =
        await this.scanning.startFileScan({
          file: input.file,
          sha256: input.sha256,
          visibility: input.visibility,
          forceRescan: input.forceRescan,
        });

      const persisted =
        await this.applyScannerResult(
          scan.id,
          result,
        );

      await this.prisma.submission.update({
        where: {
          id: input.submissionId,
        },
        data: {
          binaryDeletedAt: new Date(),
        },
      });

      await this.notifyIfCompleted(
        persisted,
        input.userId,
        input.artifactId,
      );

      return persisted;
    } catch (error) {
      await this.prisma.submission.update({
        where: {
          id: input.submissionId,
        },
        data: {
          binaryDeletedAt: new Date(),
        },
      });

      await this.failScan(scan.id, error);
      throw error;
    }
  }

  private async applyScannerResult(
    scanId: string,
    result: ScannerResult,
  ) {
    if (result.state === 'RUNNING') {
      return this.prisma.scan.update({
        where: {
          id: scanId,
        },
        data: {
          status: ScanStatus.RUNNING,
          provider: result.provider,
          providerAnalysisId:
            result.providerAnalysisId,
          providerStatus:
            result.providerStatus,
          providerCheckedAt: new Date(),
          errorMessage: null,
        },
        include: {
          engineResults: {
            include: {
              engine: true,
            },
          },
        },
      });
    }

    return this.persistCompletedScan(
      scanId,
      result,
    );
  }

  private async persistCompletedScan(
    scanId: string,
    result: ScannerCompletedResult,
  ) {
    const verdict = this.overallVerdict(
      result.results.map((item) => item.verdict),
    );

    const completedAt = result.completedAt;
    const staleAt = new Date(
      completedAt.getTime() +
        7 * 24 * 60 * 60 * 1000,
    );

    return this.prisma.$transaction(
      async (tx) => {
        await tx.scanEngineResult.deleteMany({
          where: {
            scanId,
          },
        });

        for (const item of result.results) {
          const engine =
            await tx.scanEngine.upsert({
              where: {
                name: item.engineName,
              },
              update: {
                active: true,
                provider: result.provider,
              },
              create: {
                name: item.engineName,
                provider: result.provider,
                active: true,
              },
            });

          await tx.scanEngineResult.create({
            data: {
              scanId,
              engineId: engine.id,
              verdict: item.verdict,
              detectionName:
                item.detectionName,
              engineVersion:
                item.engineVersion ?? null,
              signatureVersion:
                item.signatureVersion ?? null,
              responseTimeMs:
                item.responseTimeMs ?? null,
              rawResult: item.rawResult
                ? (item.rawResult as Prisma.InputJsonValue)
                : undefined,
            },
          });
        }

        return tx.scan.update({
          where: {
            id: scanId,
          },
          data: {
            status: ScanStatus.COMPLETED,
            overallVerdict: verdict,
            completedAt,
            staleAt,
            provider: result.provider,
            providerStatus: 'completed',
            providerCheckedAt: new Date(),
            errorMessage: null,
          },
          include: {
            engineResults: {
              include: {
                engine: true,
              },
            },
          },
        });
      },
    );
  }

  private async failScan(
    scanId: string,
    error: unknown,
  ) {
    const message =
      error instanceof Error
        ? error.message
        : 'scan failed';

    await this.prisma.scan.update({
      where: {
        id: scanId,
      },
      data: {
        status: ScanStatus.FAILED,
        providerStatus: 'error',
        providerCheckedAt: new Date(),
        errorMessage: message.slice(0, 2000),
      },
    });
  }

  private async notifyIfCompleted(
    scan: any,
    userId: string | null,
    artifactId: string,
  ) {
    if (
      userId &&
      scan.status === ScanStatus.COMPLETED
    ) {
      await this.notifications.createScanCompleted(
        userId,
        artifactId,
        scan.id,
      );
    }
  }

  private async findLatestAccessibleScan(
    artifactId: string,
    userId: string | null,
  ) {
    return this.prisma.scan.findFirst({
      where: {
        artifactId,
        OR: [
          { visibility: Visibility.PUBLIC },
          ...(userId
            ? [
                {
                  submission: {
                    is: {
                      userId,
                    },
                  },
                },
              ]
            : []),
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        engineResults: {
          include: {
            engine: true,
          },
        },
      },
    });
  }

  private parseVisibility(
    value: string | undefined,
    userId: string | null,
  ) {
    const normalized = (
      value ?? 'PUBLIC'
    ).toUpperCase();

    if (
      normalized !== Visibility.PUBLIC &&
      normalized !== Visibility.PRIVATE
    ) {
      throw new BadRequestException(
        'visibility must be PUBLIC or PRIVATE',
      );
    }

    if (
      normalized === Visibility.PRIVATE &&
      !userId
    ) {
      throw new BadRequestException(
        'private submissions require authentication',
      );
    }

    return normalized as Visibility;
  }

  private async findOrCreateFileArtifact(
    input: {
      sha256: string;
      sha1: string;
      md5: string;
      size: number;
      mimeType: string;
    },
  ) {
    const existing =
      await this.prisma.fileArtifact.findUnique({
        where: {
          sha256: input.sha256,
        },
        include: {
          artifact: true,
        },
      });

    if (existing) {
      return {
        ...existing.artifact,
        file: existing,
      };
    }

    try {
      return await this.prisma.artifact.create({
        data: {
          type: ArtifactType.FILE,
          file: {
            create: {
              sha256: input.sha256,
              sha1: input.sha1,
              md5: input.md5,
              size: BigInt(input.size),
              mimeType: input.mimeType,
            },
          },
        },
        include: {
          file: true,
        },
      });
    } catch (error) {
      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced =
          await this.prisma.fileArtifact.findUnique({
            where: {
              sha256: input.sha256,
            },
            include: {
              artifact: true,
            },
          });

        if (raced) {
          return {
            ...raced.artifact,
            file: raced,
          };
        }
      }

      throw error;
    }
  }

  private async findReusableScan(
    artifactId: string,
    visibility: Visibility,
    userId: string | null,
  ) {
    const scan =
      await this.prisma.scan.findFirst({
        where: {
          artifactId,
          status: ScanStatus.COMPLETED,
          OR:
            visibility === Visibility.PUBLIC
              ? [
                  {
                    visibility:
                      Visibility.PUBLIC,
                  },
                ]
              : [
                  {
                    visibility:
                      Visibility.PUBLIC,
                  },
                  ...(userId
                    ? [
                        {
                          submission: {
                            is: {
                              userId,
                            },
                          },
                        },
                      ]
                    : []),
                ],
        },
        orderBy: {
          completedAt: 'desc',
        },
        include: {
          engineResults: {
            include: {
              engine: true,
            },
          },
        },
      });

    if (
      !scan?.staleAt ||
      scan.staleAt <= new Date()
    ) {
      return null;
    }

    return scan;
  }

  private overallVerdict(
    verdicts: Verdict[],
  ) {
    if (
      verdicts.includes(Verdict.MALICIOUS)
    ) {
      return Verdict.MALICIOUS;
    }

    if (
      verdicts.includes(Verdict.SUSPICIOUS)
    ) {
      return Verdict.SUSPICIOUS;
    }

    if (
      verdicts.includes(Verdict.HARMLESS)
    ) {
      return Verdict.HARMLESS;
    }

    return Verdict.UNKNOWN;
  }

  private formatFileArtifact(
    artifact: any,
  ) {
    return {
      id: artifact.id,
      type: artifact.type,
      sha256: artifact.file?.sha256 ?? null,
      sha1: artifact.file?.sha1 ?? null,
      md5: artifact.file?.md5 ?? null,
      size:
        artifact.file?.size?.toString() ?? null,
      mimeType:
        artifact.file?.mimeType ?? null,
      firstSeenAt: artifact.firstSeenAt,
      lastSeenAt: artifact.lastSeenAt,
    };
  }

  private formatScan(scan: any) {
    return {
      id: scan.id,
      status: scan.status,
      reason: scan.reason,
      visibility: scan.visibility,
      overallVerdict: scan.overallVerdict,
      startedAt: scan.startedAt,
      completedAt: scan.completedAt,
      staleAt: scan.staleAt,
      provider: scan.provider ?? null,
      providerStatus:
        scan.providerStatus ?? null,
      errorMessage:
        scan.errorMessage ?? null,
      engineResults: (
        scan.engineResults ?? []
      ).map((result: any) => ({
        engine:
          result.engine?.name ??
          result.engineId,
        verdict: result.verdict,
        detectionName:
          result.detectionName,
        responseTimeMs:
          result.responseTimeMs,
      })),
    };
  }
}
