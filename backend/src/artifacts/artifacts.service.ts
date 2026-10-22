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
  SubmissionSource,
  Verdict,
  Visibility,
} from '@prisma/client';
import { createHash } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma.service';
import { ScanningService } from '../scanning/scanning.service';
import {
  ScannerCompletedResult,
  ScannerEngineResult,
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

  async searchPublicArtifacts(
    queryInput?: string,
  ) {
    const query = queryInput?.trim();

    if (!query) {
      return [];
    }

    if (query.length > 512) {
      throw new BadRequestException(
        'search query must contain at most 512 characters',
      );
    }

    const lowerQuery = query.toLowerCase();
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        query,
      );

    const artifacts =
      await this.prisma.artifact.findMany({
        where: {
          submissions: {
            some: {
              visibility: Visibility.PUBLIC,
            },
          },
          OR: [
            ...(isUuid
              ? [
                  {
                    id: query,
                  },
                ]
              : []),
            {
              file: {
                is: {
                  OR: [
                    {
                      sha256: {
                        contains: lowerQuery,
                      },
                    },
                    {
                      sha1: {
                        contains: lowerQuery,
                      },
                    },
                    {
                      md5: {
                        contains: lowerQuery,
                      },
                    },
                  ],
                },
              },
            },
            {
              url: {
                is: {
                  OR: [
                    {
                      normalizedUrl: {
                        contains: query,
                        mode: 'insensitive',
                      },
                    },
                    {
                      domain: {
                        contains: query,
                        mode: 'insensitive',
                      },
                    },
                  ],
                },
              },
            },
            {
              submissions: {
                some: {
                  visibility:
                    Visibility.PUBLIC,
                  OR: [
                    {
                      originalFilename: {
                        contains: query,
                        mode: 'insensitive',
                      },
                    },
                    {
                      originalUrl: {
                        contains: query,
                        mode: 'insensitive',
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
        orderBy: {
          lastSeenAt: 'desc',
        },
        take: 50,
        include: {
          file: true,
          url: true,
          submissions: {
            where: {
              visibility: Visibility.PUBLIC,
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
            select: {
              originalFilename: true,
              originalUrl: true,
              createdAt: true,
            },
          },
          scans: {
            where: {
              visibility: Visibility.PUBLIC,
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
            select: {
              id: true,
              status: true,
              overallVerdict: true,
              provider: true,
              completedAt: true,
            },
          },
        },
      });

    return artifacts.map((artifact) => {
      const submission =
        artifact.submissions[0] ?? null;
      const scan =
        artifact.scans[0] ?? null;

      return {
        id: artifact.id,
        type: artifact.type,
        displayName:
          submission?.originalFilename ??
          submission?.originalUrl ??
          artifact.file?.sha256 ??
          artifact.url?.normalizedUrl ??
          artifact.id,
        lastSeenAt: artifact.lastSeenAt,
        file: artifact.file
          ? {
              sha256: artifact.file.sha256,
              sha1: artifact.file.sha1,
              md5: artifact.file.md5,
              size:
                artifact.file.size.toString(),
              mimeType:
                artifact.file.mimeType,
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
          ? {
              id: scan.id,
              status: scan.status,
              verdict:
                scan.overallVerdict,
              provider: scan.provider,
              completedAt:
                scan.completedAt,
            }
          : null,
      };
    });
  }

  async searchPublicArtifactsAdvanced(input: {
    query?: string;
    type?: string;
    verdict?: string;
    sort?: string;
    page?: string | number;
    pageSize?: string | number;
  }) {
    const query = input.query?.trim() ?? '';

    if (query.length > 512) {
      throw new BadRequestException(
        'search query must contain at most 512 characters',
      );
    }

    const typeValue =
      input.type?.toUpperCase();
    const type =
      typeValue === 'FILE' ||
      typeValue === 'URL'
        ? (typeValue as ArtifactType)
        : undefined;

    if (
      input.type &&
      !type
    ) {
      throw new BadRequestException(
        'type must be FILE or URL',
      );
    }

    const verdictValue =
      input.verdict?.toUpperCase();
    const verdict =
      verdictValue &&
      Object.values(Verdict).includes(
        verdictValue as Verdict,
      )
        ? (verdictValue as Verdict)
        : undefined;

    if (
      input.verdict &&
      !verdict
    ) {
      throw new BadRequestException(
        'invalid verdict filter',
      );
    }

    const allowedSorts = [
      'LAST_SEEN_DESC',
      'LAST_SEEN_ASC',
      'FIRST_SEEN_DESC',
      'FIRST_SEEN_ASC',
    ] as const;
    const sort = (
      input.sort ?? 'LAST_SEEN_DESC'
    ).toUpperCase();

    if (
      !allowedSorts.includes(
        sort as (typeof allowedSorts)[number],
      )
    ) {
      throw new BadRequestException(
        'invalid search sort',
      );
    }

    const page = Math.max(
      1,
      Math.min(
        1000,
        Number(input.page ?? 1) || 1,
      ),
    );
    const pageSize = Math.max(
      1,
      Math.min(
        50,
        Number(input.pageSize ?? 10) || 10,
      ),
    );

    const lowerQuery =
      query.toLowerCase();
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        query,
      );

    const where: Prisma.ArtifactWhereInput = {
      submissions: {
        some: {
          visibility: Visibility.PUBLIC,
        },
      },
      ...(type ? { type } : {}),
      ...(verdict
        ? {
            scans: {
              some: {
                visibility:
                  Visibility.PUBLIC,
                overallVerdict:
                  verdict,
              },
            },
          }
        : {}),
      ...(query
        ? {
            OR: [
              ...(isUuid
                ? [{ id: query }]
                : []),
              {
                file: {
                  is: {
                    OR: [
                      {
                        sha256: {
                          contains:
                            lowerQuery,
                        },
                      },
                      {
                        sha1: {
                          contains:
                            lowerQuery,
                        },
                      },
                      {
                        md5: {
                          contains:
                            lowerQuery,
                        },
                      },
                    ],
                  },
                },
              },
              {
                url: {
                  is: {
                    OR: [
                      {
                        normalizedUrl: {
                          contains:
                            query,
                          mode:
                            'insensitive',
                        },
                      },
                      {
                        domain: {
                          contains:
                            query,
                          mode:
                            'insensitive',
                        },
                      },
                    ],
                  },
                },
              },
              {
                submissions: {
                  some: {
                    visibility:
                      Visibility.PUBLIC,
                    OR: [
                      {
                        originalFilename:
                          {
                            contains:
                              query,
                            mode:
                              'insensitive',
                          },
                      },
                      {
                        originalUrl: {
                          contains:
                            query,
                          mode:
                            'insensitive',
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const orderBy =
      sort === 'LAST_SEEN_ASC'
        ? { lastSeenAt: 'asc' as const }
        : sort === 'FIRST_SEEN_DESC'
          ? {
              firstSeenAt:
                'desc' as const,
            }
          : sort === 'FIRST_SEEN_ASC'
            ? {
                firstSeenAt:
                  'asc' as const,
              }
            : {
                lastSeenAt:
                  'desc' as const,
              };

    const [total, artifacts] =
      await this.prisma.$transaction([
        this.prisma.artifact.count({
          where,
        }),
        this.prisma.artifact.findMany({
          where,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            file: true,
            url: true,
            submissions: {
              where: {
                visibility:
                  Visibility.PUBLIC,
              },
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
              select: {
                originalFilename: true,
                originalUrl: true,
                createdAt: true,
              },
            },
            scans: {
              where: {
                visibility:
                  Visibility.PUBLIC,
                ...(verdict
                  ? {
                      overallVerdict:
                        verdict,
                    }
                  : {}),
              },
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
              select: {
                id: true,
                status: true,
                overallVerdict: true,
                provider: true,
                completedAt: true,
              },
            },
          },
        }),
      ]);

    const items = artifacts.map(
      (artifact) => {
        const submission =
          artifact.submissions[0] ??
          null;
        const scan =
          artifact.scans[0] ?? null;

        return {
          id: artifact.id,
          type: artifact.type,
          displayName:
            submission?.originalFilename ??
            submission?.originalUrl ??
            artifact.file?.sha256 ??
            artifact.url
              ?.normalizedUrl ??
            artifact.id,
          firstSeenAt:
            artifact.firstSeenAt,
          lastSeenAt:
            artifact.lastSeenAt,
          file: artifact.file
            ? {
                sha256:
                  artifact.file.sha256,
                sha1: artifact.file.sha1,
                md5: artifact.file.md5,
                size:
                  artifact.file.size.toString(),
                mimeType:
                  artifact.file.mimeType,
              }
            : null,
          url: artifact.url
            ? {
                normalizedUrl:
                  artifact.url
                    .normalizedUrl,
                domain:
                  artifact.url.domain,
              }
            : null,
          latestScan: scan
            ? {
                id: scan.id,
                status: scan.status,
                verdict:
                  scan.overallVerdict,
                provider:
                  scan.provider,
                completedAt:
                  scan.completedAt,
              }
            : null,
        };
      },
    );

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(
        1,
        Math.ceil(total / pageSize),
      ),
      sort,
      filters: {
        query,
        type: type ?? null,
        verdict: verdict ?? null,
      },
    };
  }

  async submitFile(
    uploadedFile: ScannerFile | undefined,
    userId: string | null,
    visibilityInput?: string,
    forceRescanInput?: string,
    source: SubmissionSource = SubmissionSource.WEB,
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
          source,
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

    const reason =
      source === SubmissionSource.API
        ? ScanReason.API_REQUEST
        : forceRescan
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

  async submitUrl(
    rawUrl: string | undefined,
    userId: string | null,
    visibilityInput?: string,
    forceRescanInput?: boolean | string,
    source: SubmissionSource = SubmissionSource.WEB,
  ) {
    const normalized = this.normalizeUrl(rawUrl);
    const visibility = this.parseVisibility(
      visibilityInput,
      userId,
    );
    const forceRescan =
      typeof forceRescanInput === 'boolean'
        ? forceRescanInput
        : (forceRescanInput ?? 'false')
            .toString()
            .toLowerCase() === 'true';

    const artifact =
      await this.findOrCreateUrlArtifact(
        normalized,
      );

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
          originalUrl: rawUrl!.trim(),
          source,
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
      return {
        artifact:
          this.formatUrlArtifact(artifact),
        submission: {
          id: submission.id,
          visibility: submission.visibility,
          originalUrl:
            submission.originalUrl,
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

    const reason =
      source === SubmissionSource.API
        ? ScanReason.API_REQUEST
        : forceRescan
          ? ScanReason.MANUAL_RESCAN
          : previousCompletedScan
            ? ScanReason.STALE_RESCAN
            : ScanReason.INITIAL;

    const scan =
      await this.createAndRunUrlScan({
        artifactId: artifact.id,
        submissionId: submission.id,
        userId,
        visibility,
        reason,
        normalizedUrl:
          normalized.normalizedUrl,
        forceRescan,
      });

    return {
      artifact:
        this.formatUrlArtifact(artifact),
      submission: {
        id: submission.id,
        visibility: submission.visibility,
        originalUrl:
          submission.originalUrl,
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
      submission: {
        id: allowedSubmission.id,
        visibility: allowedSubmission.visibility,
        originalFilename: allowedSubmission.originalFilename,
        originalUrl: allowedSubmission.originalUrl,
        createdAt: allowedSubmission.createdAt,
        ownedByViewer:
          Boolean(userId) &&
          allowedSubmission.userId === userId,
      },
      latestScan: scan
        ? this.formatScan(scan)
        : null,
    };
  }

  async deleteApiSubmission(
    submissionId: string,
    userId: string,
  ) {
    const submission =
      await this.prisma.submission.findFirst({
        where: {
          id: submissionId,
          userId,
          source: SubmissionSource.API,
        },
        select: {
          id: true,
          artifactId: true,
        },
      });

    if (!submission) {
      throw new NotFoundException(
        'API submission not found',
      );
    }

    await this.prisma.$transaction([
      this.prisma.submission.delete({
        where: {
          id: submission.id,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'API_SUBMISSION_DELETED',
          targetType: 'submission',
          targetId: submission.id,
          metadata: {
            artifactId:
              submission.artifactId,
          },
        },
      }),
    ]);

    return {
      success: true,
      submissionId: submission.id,
      artifactId: submission.artifactId,
    };
  }

  async getArtifactScanHistory(
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
        select: {
          id: true,
        },
      });

    if (!allowedSubmission) {
      throw new NotFoundException(
        'artifact not found',
      );
    }

    const scans = await this.prisma.scan.findMany({
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
        submission: {
          select: {
            id: true,
            userId: true,
            visibility: true,
            originalFilename: true,
            originalUrl: true,
            createdAt: true,
          },
        },
        engineResults: {
          include: {
            engine: true,
          },
        },
      },
    });

    return scans.map((scan) => ({
      ...this.formatScan(scan),
      submission: scan.submission
        ? {
            id: scan.submission.id,
            visibility: scan.submission.visibility,
            originalFilename:
              scan.submission.originalFilename,
            originalUrl:
              scan.submission.originalUrl,
            createdAt:
              scan.submission.createdAt,
            ownedByViewer:
              Boolean(userId) &&
              scan.submission.userId === userId,
          }
        : null,
    }));
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
          url: true,
        },
      });

    if (!artifact || (!artifact.file && !artifact.url)) {
      throw new NotFoundException(
        'artifact not found',
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
      const result = artifact.file
        ? await this.scanning.rescanFile({
            sha256: artifact.file.sha256,
            visibility: submission.visibility,
          })
        : await this.scanning.rescanUrl({
            normalizedUrl:
              artifact.url!.normalizedUrl,
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

  private async createAndRunUrlScan(input: {
    artifactId: string;
    submissionId: string;
    userId: string | null;
    visibility: Visibility;
    reason: ScanReason;
    normalizedUrl: string;
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
        await this.scanning.startUrlScan({
          normalizedUrl:
            input.normalizedUrl,
          visibility: input.visibility,
          forceRescan: input.forceRescan,
        });

      const persisted =
        await this.applyScannerResult(
          scan.id,
          result,
        );

      await this.notifyIfCompleted(
        persisted,
        input.userId,
        input.artifactId,
      );

      return persisted;
    } catch (error) {
      await this.failScan(scan.id, error);
      throw error;
    }
  }

  private async applyScannerResult(
    scanId: string,
    result: ScannerResult,
  ) {
    if (result.state === 'RUNNING') {
      if (result.partialResults?.length) {
        await this.prisma.$transaction(
          async (tx) => {
            await this.persistEngineResults(
              tx,
              scanId,
              result.provider,
              result.partialResults ?? [],
            );
          },
        );
      }

      const partialVerdict =
        result.partialResults?.length
          ? this.overallVerdict(
              result.partialResults.map(
                (item) => item.verdict,
              ),
            )
          : Verdict.UNKNOWN;

      return this.prisma.scan.update({
        where: {
          id: scanId,
        },
        data: {
          status: ScanStatus.RUNNING,
          overallVerdict: partialVerdict,
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
    const completedAt = result.completedAt;
    const staleAt = new Date(
      completedAt.getTime() +
        7 * 24 * 60 * 60 * 1000,
    );

    return this.prisma.$transaction(
      async (tx) => {
        await this.persistEngineResults(
          tx,
          scanId,
          result.provider,
          result.results,
        );

        const storedResults =
          await tx.scanEngineResult.findMany({
            where: {
              scanId,
            },
            select: {
              verdict: true,
            },
          });

        const verdict = this.overallVerdict(
          storedResults.map(
            (item) => item.verdict,
          ),
        );

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

  private async persistEngineResults(
    tx: Prisma.TransactionClient,
    scanId: string,
    provider: string,
    results: ScannerEngineResult[],
  ) {
    for (const item of results) {
      const engine =
        await tx.scanEngine.upsert({
          where: {
            name: item.engineName,
          },
          update: {
            active: true,
            provider,
          },
          create: {
            name: item.engineName,
            provider,
            active: true,
          },
        });

      await tx.scanEngineResult.upsert({
        where: {
          scanId_engineId: {
            scanId,
            engineId: engine.id,
          },
        },
        update: {
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
            : Prisma.JsonNull,
        },
        create: {
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

  private async findOrCreateUrlArtifact(
    input: {
      normalizedUrl: string;
      urlHash: string;
      domain: string;
    },
  ) {
    const existing =
      await this.prisma.urlArtifact.findUnique({
        where: {
          urlHash: input.urlHash,
        },
        include: {
          artifact: true,
        },
      });

    if (existing) {
      return {
        ...existing.artifact,
        url: existing,
      };
    }

    try {
      return await this.prisma.artifact.create({
        data: {
          type: ArtifactType.URL,
          url: {
            create: {
              normalizedUrl:
                input.normalizedUrl,
              urlHash: input.urlHash,
              domain: input.domain,
            },
          },
        },
        include: {
          url: true,
        },
      });
    } catch (error) {
      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced =
          await this.prisma.urlArtifact.findUnique({
            where: {
              urlHash: input.urlHash,
            },
            include: {
              artifact: true,
            },
          });

        if (raced) {
          return {
            ...raced.artifact,
            url: raced,
          };
        }
      }

      throw error;
    }
  }

  private normalizeUrl(
    rawUrl: string | undefined,
  ) {
    const value = rawUrl?.trim();

    if (!value) {
      throw new BadRequestException(
        'url is required',
      );
    }

    if (value.length > 4096) {
      throw new BadRequestException(
        'url must contain at most 4096 characters',
      );
    }

    let parsed: URL;

    try {
      parsed = new URL(value);
    } catch {
      throw new BadRequestException(
        'a valid absolute URL is required',
      );
    }

    if (
      parsed.protocol !== 'http:' &&
      parsed.protocol !== 'https:'
    ) {
      throw new BadRequestException(
        'only http and https URLs are supported',
      );
    }

    if (
      parsed.username ||
      parsed.password
    ) {
      throw new BadRequestException(
        'URLs containing embedded credentials are not accepted',
      );
    }

    parsed.hash = '';

    const normalizedUrl =
      parsed.toString();
    const urlHash = createHash('sha256')
      .update(normalizedUrl)
      .digest('hex');

    return {
      normalizedUrl,
      urlHash,
      domain: parsed.hostname,
    };
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
          provider: this.scanning.providerName,
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

  private formatUrlArtifact(
    artifact: any,
  ) {
    return {
      id: artifact.id,
      type: artifact.type,
      normalizedUrl:
        artifact.url?.normalizedUrl ?? null,
      domain:
        artifact.url?.domain ?? null,
      firstSeenAt: artifact.firstSeenAt,
      lastSeenAt: artifact.lastSeenAt,
    };
  }

  private formatScan(scan: any) {
    return {
      id: scan.id,
      createdAt: scan.createdAt,
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
        category:
          typeof result.rawResult?.category === 'string'
            ? result.rawResult.category
            : null,
        detectionName:
          result.detectionName,
        responseTimeMs:
          result.responseTimeMs,
      })),
    };
  }
}
