import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ArtifactType,
  NotificationType,
  Prisma,
  ScanReason,
  ScanStatus,
  Verdict,
  Visibility,
} from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma.service';

type UploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class ArtifactsService {
  constructor(private readonly prisma: PrismaService) {}

  async submitFile(
    file: UploadedFile | undefined,
    userId: string | null,
    visibilityInput?: string,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('file is required');
    }

    const visibility = this.parseVisibility(visibilityInput, userId);

    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const sha1 = createHash('sha1').update(file.buffer).digest('hex');
    const md5 = createHash('md5').update(file.buffer).digest('hex');

    const artifact = await this.findOrCreateFileArtifact({
      sha256,
      sha1,
      md5,
      size: file.size,
      mimeType: file.mimetype || 'application/octet-stream',
    });

    await this.prisma.artifact.update({
      where: { id: artifact.id },
      data: { lastSeenAt: new Date() },
    });

    const submission = await this.prisma.submission.create({
      data: {
        artifactId: artifact.id,
        userId,
        visibility,
        originalFilename: file.originalname,
        binaryDeleteDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const latestScan = await this.findReusableScan(
      artifact.id,
      visibility,
      userId,
    );

    if (latestScan) {
      await this.prisma.submission.update({
        where: { id: submission.id },
        data: { binaryDeletedAt: new Date() },
      });

      return {
        artifact: this.formatFileArtifact(artifact),
        submission: {
          id: submission.id,
          visibility: submission.visibility,
          originalFilename: submission.originalFilename,
          createdAt: submission.createdAt,
        },
        scan: this.formatScan(latestScan),
        reusedScan: true,
      };
    }

    const scan = await this.runDevelopmentScan({
      artifactId: artifact.id,
      submissionId: submission.id,
      userId,
      visibility,
      file,
    });

    return {
      artifact: this.formatFileArtifact(artifact),
      submission: {
        id: submission.id,
        visibility: submission.visibility,
        originalFilename: submission.originalFilename,
        createdAt: submission.createdAt,
      },
      scan: this.formatScan(scan),
      reusedScan: false,
    };
  }

  async getArtifact(artifactId: string, userId: string | null) {
    const allowedSubmission = await this.prisma.submission.findFirst({
      where: {
        artifactId,
        OR: [
          { visibility: Visibility.PUBLIC },
          ...(userId ? [{ userId }] : []),
        ],
      },
      select: {
        id: true,
        visibility: true,
      },
    });

    if (!allowedSubmission) {
      throw new NotFoundException('artifact not found');
    }

    const artifact = await this.prisma.artifact.findUnique({
      where: { id: artifactId },
      include: {
        file: true,
        url: true,
      },
    });

    if (!artifact) {
      throw new NotFoundException('artifact not found');
    }

    const scan = await this.prisma.scan.findFirst({
      where: {
        artifactId,
        status: ScanStatus.COMPLETED,
        OR: [
          { visibility: Visibility.PUBLIC },
          ...(userId
            ? [
                {
                  submission: {
                    userId,
                  },
                },
              ]
            : []),
        ],
      },
      orderBy: { completedAt: 'desc' },
      include: {
        engineResults: {
          include: {
            engine: true,
          },
        },
      },
    });

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
            normalizedUrl: artifact.url.normalizedUrl,
            domain: artifact.url.domain,
          }
        : null,
      latestScan: scan ? this.formatScan(scan) : null,
    };
  }

  private parseVisibility(value: string | undefined, userId: string | null) {
    const normalized = (value ?? 'PUBLIC').toUpperCase();

    if (
      normalized !== Visibility.PUBLIC &&
      normalized !== Visibility.PRIVATE
    ) {
      throw new BadRequestException('visibility must be PUBLIC or PRIVATE');
    }

    if (normalized === Visibility.PRIVATE && !userId) {
      throw new BadRequestException(
        'private submissions require authentication',
      );
    }

    return normalized as Visibility;
  }

  private async findOrCreateFileArtifact(input: {
    sha256: string;
    sha1: string;
    md5: string;
    size: number;
    mimeType: string;
  }) {
    const existing = await this.prisma.fileArtifact.findUnique({
      where: { sha256: input.sha256 },
      include: { artifact: true },
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
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.prisma.fileArtifact.findUnique({
          where: { sha256: input.sha256 },
          include: { artifact: true },
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
    const scan = await this.prisma.scan.findFirst({
      where: {
        artifactId,
        status: ScanStatus.COMPLETED,
        OR:
          visibility === Visibility.PUBLIC
            ? [{ visibility: Visibility.PUBLIC }]
            : [
                { visibility: Visibility.PUBLIC },
                ...(userId
                  ? [
                      {
                        submission: {
                          userId,
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

    if (!scan?.staleAt || scan.staleAt <= new Date()) {
      return null;
    }

    return scan;
  }

  private async runDevelopmentScan(input: {
    artifactId: string;
    submissionId: string;
    userId: string | null;
    visibility: Visibility;
    file: UploadedFile;
  }) {
    const previousCompletedScan = await this.prisma.scan.findFirst({
      where: {
        artifactId: input.artifactId,
        status: ScanStatus.COMPLETED,
      },
      select: { id: true },
    });

    const scan = await this.prisma.scan.create({
      data: {
        artifactId: input.artifactId,
        submissionId: input.submissionId,
        visibility: input.visibility,
        status: ScanStatus.RUNNING,
        reason: previousCompletedScan
          ? ScanReason.STALE_RESCAN
          : ScanReason.INITIAL,
        startedAt: new Date(),
      },
    });

    const engine = await this.prisma.scanEngine.upsert({
      where: {
        name: 'Local EICAR Test Engine',
      },
      update: {
        active: true,
      },
      create: {
        name: 'Local EICAR Test Engine',
        provider: 'local-development',
        active: true,
      },
    });

    const containsEicar = file.buffer
      .toString('utf8')
      .includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE');

    const engineVerdict = containsEicar
      ? Verdict.MALICIOUS
      : Verdict.UNKNOWN;

    await this.prisma.scanEngineResult.create({
      data: {
        scanId: scan.id,
        engineId: engine.id,
        verdict: engineVerdict,
        detectionName: containsEicar ? 'EICAR-Test-File' : null,
        rawResult: {
          developmentOnly: true,
          message: containsEicar
            ? 'EICAR antivirus test signature detected.'
            : 'No EICAR test signature detected. This is not a full antivirus verdict.',
        },
      },
    });

    const completedAt = new Date();
    const staleAt = new Date(
      completedAt.getTime() + 7 * 24 * 60 * 60 * 1000,
    );

    const completedScan = await this.prisma.scan.update({
      where: { id: scan.id },
      data: {
        status: ScanStatus.COMPLETED,
        overallVerdict: engineVerdict,
        completedAt,
        staleAt,
      },
      include: {
        engineResults: {
          include: {
            engine: true,
          },
        },
      },
    });

    await this.prisma.submission.update({
      where: { id: input.submissionId },
      data: {
        binaryDeletedAt: new Date(),
      },
    });

    if (input.userId) {
      await this.prisma.notification.create({
        data: {
          userId: input.userId,
          type: NotificationType.SCAN_COMPLETED,
          artifactId: input.artifactId,
          entityType: 'scan',
          entityId: completedScan.id,
          message: 'Your file scan is complete.',
        },
      });
    }

    return completedScan;
  }

  private formatFileArtifact(artifact: any) {
    return {
      id: artifact.id,
      type: artifact.type,
      sha256: artifact.file?.sha256 ?? null,
      sha1: artifact.file?.sha1 ?? null,
      md5: artifact.file?.md5 ?? null,
      size: artifact.file?.size?.toString() ?? null,
      mimeType: artifact.file?.mimeType ?? null,
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
      engineResults: (scan.engineResults ?? []).map((result: any) => ({
        engine: result.engine?.name ?? result.engineId,
        verdict: result.verdict,
        detectionName: result.detectionName,
        responseTimeMs: result.responseTimeMs,
      })),
    };
  }
}
