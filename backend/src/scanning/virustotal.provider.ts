import {
  BadGatewayException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Verdict } from '@prisma/client';
import {
  RescanFileInput,
  ScannerCompletedResult,
  ScannerEngineResult,
  ScannerPendingResult,
  ScannerResult,
  StartFileScanInput,
} from './scanning.types';

type VirusTotalEngineResult = {
  category?: string;
  engine_name?: string;
  engine_version?: string | null;
  engine_update?: string | null;
  method?: string | null;
  result?: string | null;
};

type VirusTotalAnalysis = {
  data?: {
    id?: string;
    attributes?: {
      status?: string;
      date?: number;
      results?: Record<string, VirusTotalEngineResult>;
    };
  };
};

type VirusTotalFileReport = {
  data?: {
    attributes?: {
      last_analysis_date?: number;
      last_analysis_results?: Record<string, VirusTotalEngineResult>;
    };
  };
};

@Injectable()
export class VirusTotalProvider {
  readonly name = 'virustotal';
  readonly supportsPrivate = false;

  private readonly logger = new Logger(VirusTotalProvider.name);
  private readonly baseUrl =
    process.env.VIRUSTOTAL_BASE_URL?.trim() ||
    'https://www.virustotal.com/api/v3';

  get configured() {
    return Boolean(process.env.VIRUSTOTAL_API_KEY?.trim());
  }

  async scanFile(
    input: StartFileScanInput,
  ): Promise<ScannerResult> {
    this.requireConfiguration();

    if (!input.forceRescan) {
      const existing = await this.getExistingReport(input.sha256);

      if (existing) {
        return existing;
      }
    }

    if (input.forceRescan) {
      const reanalysis = await this.requestRescan(input.sha256);

      if (reanalysis) {
        return reanalysis;
      }
    }

    return this.uploadFile(input);
  }

  async rescanFile(
    input: RescanFileInput,
  ): Promise<ScannerResult> {
    this.requireConfiguration();

    const reanalysis = await this.requestRescan(input.sha256);

    if (reanalysis) {
      return reanalysis;
    }

    throw new BadGatewayException(
      'VirusTotal does not know this file hash. Re-upload the original file to scan it again.',
    );
  }

  async pollAnalysis(
    analysisId: string,
  ): Promise<ScannerResult> {
    this.requireConfiguration();

    const response = await this.request(
      this.baseUrl + '/analyses/' + encodeURIComponent(analysisId),
      {
        method: 'GET',
      },
    );

    if (!response.ok) {
      throw await this.providerError(
        response,
        'Could not retrieve VirusTotal analysis',
      );
    }

    const body = (await response.json()) as VirusTotalAnalysis;
    const status = body.data?.attributes?.status ?? 'unknown';

    if (status !== 'completed') {
      return {
        state: 'RUNNING',
        provider: this.name,
        providerAnalysisId: analysisId,
        providerStatus: status,
      };
    }

    return this.completedFromResults(
      body.data?.attributes?.results ?? {},
      body.data?.attributes?.date,
    );
  }

  private async getExistingReport(
    sha256: string,
  ): Promise<ScannerResult | null> {
    const response = await this.request(
      this.baseUrl + '/files/' + encodeURIComponent(sha256),
      {
        method: 'GET',
      },
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw await this.providerError(
        response,
        'Could not retrieve VirusTotal file report',
      );
    }

    const body = (await response.json()) as VirusTotalFileReport;
    const results =
      body.data?.attributes?.last_analysis_results;
    const lastAnalysisDate =
      body.data?.attributes?.last_analysis_date;

    if (!results) {
      return null;
    }

    const lastAnalysisMs = lastAnalysisDate
      ? lastAnalysisDate * 1000
      : 0;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    if (
      !lastAnalysisMs ||
      Date.now() - lastAnalysisMs > sevenDaysMs
    ) {
      return this.requestRescanFromKnownFile(sha256);
    }

    return this.completedFromResults(
      results,
      lastAnalysisDate,
    );
  }

  private async uploadFile(
    input: StartFileScanInput,
  ): Promise<ScannerPendingResult> {
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(input.file.buffer)], {
        type: input.file.mimetype || 'application/octet-stream',
      }),
      input.file.originalname,
    );

    const response = await this.request(
      this.baseUrl + '/files',
      {
        method: 'POST',
        body: form,
      },
    );

    if (!response.ok) {
      throw await this.providerError(
        response,
        'Could not submit file to VirusTotal',
      );
    }

    const body = (await response.json()) as VirusTotalAnalysis;
    const analysisId = body.data?.id;

    if (!analysisId) {
      throw new BadGatewayException(
        'VirusTotal did not return an analysis identifier.',
      );
    }

    return {
      state: 'RUNNING',
      provider: this.name,
      providerAnalysisId: analysisId,
      providerStatus: 'queued',
    };
  }

  private async requestRescanFromKnownFile(
    sha256: string,
  ): Promise<ScannerPendingResult | null> {
    return this.requestRescan(sha256);
  }

  private async requestRescan(
    sha256: string,
  ): Promise<ScannerPendingResult | null> {
    const response = await this.request(
      this.baseUrl +
        '/files/' +
        encodeURIComponent(sha256) +
        '/analyse',
      {
        method: 'POST',
      },
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw await this.providerError(
        response,
        'Could not request VirusTotal re-analysis',
      );
    }

    const body = (await response.json()) as VirusTotalAnalysis;
    const analysisId = body.data?.id;

    if (!analysisId) {
      throw new BadGatewayException(
        'VirusTotal did not return an analysis identifier.',
      );
    }

    return {
      state: 'RUNNING',
      provider: this.name,
      providerAnalysisId: analysisId,
      providerStatus: 'queued',
    };
  }

  private completedFromResults(
    results: Record<string, VirusTotalEngineResult>,
    completedUnixSeconds?: number,
  ): ScannerCompletedResult {
    const normalized = Object.entries(results).map(
      ([fallbackName, result]): ScannerEngineResult => ({
        engineName: result.engine_name || fallbackName,
        verdict: this.mapVerdict(result.category),
        detectionName: result.result ?? null,
        engineVersion: result.engine_version ?? null,
        signatureVersion: result.engine_update ?? null,
        rawResult: {
          category: result.category ?? 'unknown',
          method: result.method ?? null,
          result: result.result ?? null,
          engineUpdate: result.engine_update ?? null,
        },
      }),
    );

    return {
      state: 'COMPLETED',
      provider: this.name,
      completedAt: completedUnixSeconds
        ? new Date(completedUnixSeconds * 1000)
        : new Date(),
      results: normalized,
    };
  }

  private mapVerdict(category?: string): Verdict {
    if (category === 'malicious') return Verdict.MALICIOUS;
    if (category === 'suspicious') return Verdict.SUSPICIOUS;
    if (category === 'harmless') return Verdict.HARMLESS;
    return Verdict.UNKNOWN;
  }

  private async request(
    url: string,
    init: RequestInit,
  ) {
    const headers = new Headers(init.headers);
    headers.set(
      'x-apikey',
      process.env.VIRUSTOTAL_API_KEY?.trim() ?? '',
    );
    headers.set('accept', 'application/json');

    const started = Date.now();

    try {
      const response = await fetch(url, {
        ...init,
        headers,
        signal: AbortSignal.timeout(
          Number(process.env.SCANNER_HTTP_TIMEOUT_MS ?? 30000),
        ),
      });

      this.logger.debug(
        'VirusTotal ' +
          init.method +
          ' ' +
          response.status +
          ' (' +
          (Date.now() - started) +
          ' ms)',
      );

      return response;
    } catch (error: any) {
      this.logger.error(
        'VirusTotal request failed: ' +
          (error?.message ?? 'unknown error'),
      );
      throw new BadGatewayException(
        'VirusTotal is temporarily unavailable.',
      );
    }
  }

  private async providerError(
    response: Response,
    fallback: string,
  ) {
    let detail = '';

    try {
      const body = await response.json();
      detail =
        body?.error?.message ??
        body?.message ??
        '';
    } catch {
      detail = '';
    }

    const suffix = detail ? ': ' + detail : '';
    return new BadGatewayException(fallback + suffix);
  }

  private requireConfiguration() {
    if (!this.configured) {
      throw new BadGatewayException(
        'VIRUSTOTAL_API_KEY is not configured.',
      );
    }
  }
}
