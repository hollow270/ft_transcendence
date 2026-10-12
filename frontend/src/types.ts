export type User = {
  id: string;
  username: string;
  email: string;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
  status?: string;
};

export type EngineResult = {
  engine: string;
  verdict: string;
  detectionName: string | null;
  responseTimeMs: number | null;
};

export type Scan = {
  id: string;
  status: string;
  reason: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  overallVerdict: string;
  startedAt: string | null;
  completedAt: string | null;
  staleAt: string | null;
  engineResults: EngineResult[];
};

export type Artifact = {
  id: string;
  type: 'FILE' | 'URL';
  firstSeenAt: string;
  lastSeenAt: string;
  file: {
    sha256: string;
    sha1: string | null;
    md5: string | null;
    size: string;
    mimeType: string;
  } | null;
  url: {
    normalizedUrl: string;
    domain: string | null;
  } | null;
  latestScan: Scan | null;
};

export type UploadResponse = {
  artifact: {
    id: string;
    type: 'FILE';
    sha256: string;
    sha1: string | null;
    md5: string | null;
    size: string | null;
    mimeType: string | null;
  };
  submission: {
    id: string;
    visibility: 'PUBLIC' | 'PRIVATE';
    originalFilename: string | null;
    createdAt: string;
  };
  scan: Scan;
  reusedScan: boolean;
};

export type Comment = {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  editedAt?: string | null;
  user: {
    id: string;
    username: string;
    role?: string;
  };
};

export type VoteSummary = {
  artifactId: string;
  counts: {
    HARMLESS: number;
    SUSPICIOUS: number;
    MALICIOUS: number;
  };
};

export type Notification = {
  id: string;
  type: string;
  message: string | null;
  artifactId: string | null;
  createdAt: string;
  readAt: string | null;
};
