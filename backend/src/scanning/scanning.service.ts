import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { Visibility } from '@prisma/client';
import { ClamAvProvider } from './clamav.provider';
import { DevelopmentScanProvider } from './development-scan.provider';
import {
  RescanFileInput,
  ScannerCompletedResult,
  ScannerPendingResult,
  ScannerResult,
  StartFileScanInput,
} from './scanning.types';
import { VirusTotalProvider } from './virustotal.provider';

@Injectable()
export class ScanningService {
  constructor(
    private readonly development: DevelopmentScanProvider,
    private readonly clamAv: ClamAvProvider,
    private readonly virusTotal: VirusTotalProvider,
  ) {}

  get providerName() {
    return this.mode();
  }

  getCapabilities() {
    const mode = this.mode();

    if (mode === 'development') {
      return {
        provider: mode,
        configured: true,
        supportsPrivate: true,
        maxFileSizeMb: Number(
          process.env.MAX_FILE_SIZE_MB ?? 25,
        ),
        external: false,
        engines: [
          {
            name: 'development',
            configured: true,
            supportsPrivate: true,
          },
        ],
      };
    }

    if (mode === 'clamav') {
      return {
        provider: mode,
        configured: this.clamAv.configured,
        supportsPrivate: true,
        maxFileSizeMb: Number(
          process.env.MAX_FILE_SIZE_MB ?? 25,
        ),
        external: false,
        engines: [
          {
            name: 'clamav',
            configured: this.clamAv.configured,
            supportsPrivate: true,
          },
        ],
      };
    }

    if (mode === 'virustotal') {
      return {
        provider: mode,
        configured: this.virusTotal.configured,
        supportsPrivate: false,
        maxFileSizeMb: Number(
          process.env.MAX_FILE_SIZE_MB ?? 25,
        ),
        external: true,
        engines: [
          {
            name: 'virustotal',
            configured: this.virusTotal.configured,
            supportsPrivate: false,
          },
        ],
      };
    }

    return {
      provider: 'real',
      configured: this.clamAv.configured,
      supportsPrivate: true,
      maxFileSizeMb: Number(
        process.env.MAX_FILE_SIZE_MB ?? 25,
      ),
      external: this.virusTotal.configured,
      engines: [
        {
          name: 'clamav',
          configured: this.clamAv.configured,
          supportsPrivate: true,
        },
        {
          name: 'virustotal',
          configured: this.virusTotal.configured,
          supportsPrivate: false,
        },
      ],
    };
  }

  async startFileScan(
    input: StartFileScanInput,
  ): Promise<ScannerResult> {
    const mode = this.mode();

    if (mode === 'development') {
      return this.development.scanFile(input);
    }

    if (mode === 'clamav') {
      return this.clamAv.scanFile(input);
    }

    if (mode === 'virustotal') {
      this.ensurePrivacy(
        this.virusTotal.supportsPrivate,
        input.visibility,
      );
      return this.virusTotal.scanFile(input);
    }

    return this.startRealScan(input);
  }

  async rescanFile(
    input: RescanFileInput,
  ): Promise<ScannerResult> {
    const mode = this.mode();

    if (mode === 'development') {
      return this.development.rescanFile(input);
    }

    if (mode === 'clamav') {
      return this.clamAv.rescanFile();
    }

    if (mode === 'virustotal') {
      this.ensurePrivacy(
        this.virusTotal.supportsPrivate,
        input.visibility,
      );
      return this.virusTotal.rescanFile(input);
    }

    if (input.visibility === Visibility.PRIVATE) {
      return this.clamAv.rescanFile();
    }

    if (!this.virusTotal.configured) {
      return this.clamAv.rescanFile();
    }

    const result =
      await this.virusTotal.rescanFile(input);

    return this.wrapVirusTotalResult(result);
  }

  async poll(
    providerName: string,
    providerAnalysisId: string,
  ): Promise<ScannerResult> {
    if (providerName === this.virusTotal.name) {
      return this.virusTotal.pollAnalysis(
        providerAnalysisId,
      );
    }

    if (providerName === 'real') {
      const result =
        await this.virusTotal.pollAnalysis(
          providerAnalysisId,
        );

      return this.wrapVirusTotalResult(result);
    }

    throw new BadRequestException(
      'This scan provider does not have a pending external analysis.',
    );
  }

  private async startRealScan(
    input: StartFileScanInput,
  ): Promise<ScannerResult> {
    const local =
      await this.clamAv.scanFile(input);

    if (input.visibility === Visibility.PRIVATE) {
      return {
        state: 'COMPLETED',
        provider: 'real',
        completedAt: local.completedAt,
        results: local.results,
      };
    }

    if (!this.virusTotal.configured) {
      return {
        state: 'COMPLETED',
        provider: 'real',
        completedAt: local.completedAt,
        results: local.results,
      };
    }

    const external =
      await this.virusTotal.scanFile(input);

    if (external.state === 'COMPLETED') {
      return {
        state: 'COMPLETED',
        provider: 'real',
        completedAt:
          external.completedAt >
          local.completedAt
            ? external.completedAt
            : local.completedAt,
        results: [
          ...local.results,
          ...external.results,
        ],
      };
    }

    return {
      state: 'RUNNING',
      provider: 'real',
      providerAnalysisId:
        external.providerAnalysisId,
      providerStatus:
        'virustotal:' +
        external.providerStatus,
      partialResults: local.results,
    };
  }

  private wrapVirusTotalResult(
    result: ScannerResult,
  ): ScannerResult {
    if (result.state === 'COMPLETED') {
      const completed: ScannerCompletedResult = {
        ...result,
        provider: 'real',
      };
      return completed;
    }

    const pending: ScannerPendingResult = {
      ...result,
      provider: 'real',
      providerStatus:
        'virustotal:' +
        result.providerStatus,
    };
    return pending;
  }

  private mode() {
    const configured =
      (process.env.SCAN_PROVIDER ??
        'development')
        .trim()
        .toLowerCase();

    if (
      configured === 'development' ||
      configured === 'clamav' ||
      configured === 'virustotal' ||
      configured === 'real'
    ) {
      return configured;
    }

    throw new BadRequestException(
      'Unsupported SCAN_PROVIDER: ' +
        configured,
    );
  }

  private ensurePrivacy(
    supportsPrivate: boolean,
    visibility: Visibility,
  ) {
    if (
      visibility === Visibility.PRIVATE &&
      !supportsPrivate
    ) {
      throw new BadRequestException(
        'Private submissions cannot be sent to the configured public scanner.',
      );
    }
  }
}
