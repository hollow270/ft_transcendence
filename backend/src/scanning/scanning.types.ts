import { Verdict, Visibility } from '@prisma/client';

export type ScannerFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export type ScannerEngineResult = {
  engineName: string;
  verdict: Verdict;
  detectionName: string | null;
  engineVersion?: string | null;
  signatureVersion?: string | null;
  responseTimeMs?: number | null;
  rawResult?: Record<string, unknown> | null;
};

export type ScannerCompletedResult = {
  state: 'COMPLETED';
  provider: string;
  completedAt: Date;
  results: ScannerEngineResult[];
};

export type ScannerPendingResult = {
  state: 'RUNNING';
  provider: string;
  providerAnalysisId: string;
  providerStatus: string;
};

export type ScannerResult =
  | ScannerCompletedResult
  | ScannerPendingResult;

export type StartFileScanInput = {
  file: ScannerFile;
  sha256: string;
  visibility: Visibility;
  forceRescan: boolean;
};

export type RescanFileInput = {
  sha256: string;
  visibility: Visibility;
};
