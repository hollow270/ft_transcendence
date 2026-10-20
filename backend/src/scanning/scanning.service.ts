import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { Visibility } from '@prisma/client';
import { DevelopmentScanProvider } from './development-scan.provider';
import {
  RescanFileInput,
  ScannerResult,
  StartFileScanInput,
} from './scanning.types';
import { VirusTotalProvider } from './virustotal.provider';

@Injectable()
export class ScanningService {
  constructor(
    private readonly development: DevelopmentScanProvider,
    private readonly virusTotal: VirusTotalProvider,
  ) {}

  get providerName() {
    return this.resolveProvider().name;
  }

  async startFileScan(
    input: StartFileScanInput,
  ): Promise<ScannerResult> {
    const provider = this.resolveProvider();
    this.ensurePrivacy(provider.supportsPrivate, input.visibility);

    return provider.scanFile(input);
  }

  async rescanFile(
    input: RescanFileInput,
  ): Promise<ScannerResult> {
    const provider = this.resolveProvider();
    this.ensurePrivacy(provider.supportsPrivate, input.visibility);

    return provider.rescanFile(input);
  }

  async poll(
    providerName: string,
    providerAnalysisId: string,
  ): Promise<ScannerResult> {
    if (providerName === this.virusTotal.name) {
      return this.virusTotal.pollAnalysis(providerAnalysisId);
    }

    throw new BadRequestException(
      'This scan provider does not have a pending external analysis.',
    );
  }

  private resolveProvider() {
    const configured =
      (process.env.SCAN_PROVIDER ?? 'development')
        .trim()
        .toLowerCase();

    if (configured === 'virustotal') {
      return this.virusTotal;
    }

    if (configured === 'development') {
      return this.development;
    }

    throw new BadRequestException(
      'Unsupported SCAN_PROVIDER: ' + configured,
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
        'Private submissions cannot be sent to the configured public scanner. Use PUBLIC visibility or configure a privacy-preserving scanner.',
      );
    }
  }
}
