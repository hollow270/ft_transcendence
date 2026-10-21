import { Injectable } from '@nestjs/common';
import { Verdict } from '@prisma/client';
import {
  RescanFileInput,
  RescanUrlInput,
  ScannerCompletedResult,
  StartFileScanInput,
  StartUrlScanInput,
} from './scanning.types';

@Injectable()
export class DevelopmentScanProvider {
  readonly name = 'development';
  readonly supportsPrivate = true;

  async scanFile(
    input: StartFileScanInput,
  ): Promise<ScannerCompletedResult> {
    return this.unknownResult(
      'Development Placeholder',
      input.file.mimetype || 'application/octet-stream',
    );
  }

  async rescanFile(
    _input: RescanFileInput,
  ): Promise<ScannerCompletedResult> {
    return this.unknownResult(
      'Development Placeholder',
      'binary not retained',
    );
  }

  async scanUrl(
    input: StartUrlScanInput,
  ): Promise<ScannerCompletedResult> {
    return this.unknownResult(
      'Development URL Placeholder',
      input.normalizedUrl,
    );
  }

  async rescanUrl(
    input: RescanUrlInput,
  ): Promise<ScannerCompletedResult> {
    return this.unknownResult(
      'Development URL Placeholder',
      input.normalizedUrl,
    );
  }

  private unknownResult(
    engineName: string,
    detail: string,
  ): ScannerCompletedResult {
    return {
      state: 'COMPLETED',
      provider: this.name,
      completedAt: new Date(),
      results: [
        {
          engineName,
          verdict: Verdict.UNKNOWN,
          detectionName: null,
          rawResult: {
            developmentOnly: true,
            detail,
            message:
              'No external scanner is configured. This result is not an antivirus verdict.',
          },
        },
      ],
    };
  }
}
