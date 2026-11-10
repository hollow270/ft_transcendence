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
  category: string | null;
  detectionName: string | null;
  responseTimeMs: number | null;
};

export type Scan = {
  id: string;
  createdAt: string;
  status: string;
  reason: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  overallVerdict: string;
  startedAt: string | null;
  completedAt: string | null;
  staleAt: string | null;
  provider: string | null;
  providerStatus: string | null;
  errorMessage: string | null;
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
  submission: {
    id: string;
    visibility: 'PUBLIC' | 'PRIVATE';
    originalFilename: string | null;
    originalUrl: string | null;
    createdAt: string;
    ownedByViewer: boolean;
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


export type UserCommunitySubmission = {
  id: string;
  artifactId: string;
  artifactType: 'FILE' | 'URL';
  displayName: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  createdAt: string;
  latestScan: {
    id: string;
    status: string;
    verdict: string;
    completedAt: string | null;
  } | null;
};

export type UserCommunityComment = {
  id: string;
  artifactId: string;
  artifactType: 'FILE' | 'URL';
  artifactDisplayName: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
};

export type UserCommunity = {
  user: {
    id: string;
    username: string;
    role: 'USER' | 'MODERATOR' | 'ADMIN';
    createdAt: string;
  };
  isOwner: boolean;
  submissions: UserCommunitySubmission[];
  comments: UserCommunityComment[];
};


export type ScannerCapabilities = {
  provider: string;
  configured: boolean;
  supportsPrivate: boolean;
  maxFileSizeMb: number;
  external: boolean;
  engines: Array<{
    name: string;
    configured: boolean;
    supportsPrivate: boolean;
  }>;
};


export type ArtifactScanHistoryItem = Scan & {
  submission: {
    id: string;
    visibility: 'PUBLIC' | 'PRIVATE';
    originalFilename: string | null;
    originalUrl: string | null;
    createdAt: string;
    ownedByViewer: boolean;
  } | null;
};


export type UrlSubmissionResponse = {
  artifact: {
    id: string;
    type: 'URL';
    normalizedUrl: string | null;
    domain: string | null;
    firstSeenAt: string;
    lastSeenAt: string;
  };
  submission: {
    id: string;
    visibility: 'PUBLIC' | 'PRIVATE';
    originalUrl: string | null;
    createdAt: string;
  };
  scan: Scan;
  reusedScan: boolean;
};


export type SearchResult = {
  id: string;
  type: 'FILE' | 'URL';
  displayName: string;
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
  latestScan: {
    id: string;
    status: string;
    verdict: string;
    provider: string | null;
    completedAt: string | null;
  } | null;
};

export type HistoryItem = {
  id: string;
  artifactId: string;
  artifactType: 'FILE' | 'URL';
  displayName: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  source: string;
  createdAt: string;
  file: {
    sha256: string;
    mimeType: string;
    size: string;
  } | null;
  url: {
    normalizedUrl: string;
    domain: string | null;
  } | null;
  latestScan: {
    id: string;
    status: string;
    reason: string;
    visibility: 'PUBLIC' | 'PRIVATE';
    verdict: string;
    provider: string | null;
    createdAt: string;
    completedAt: string | null;
  } | null;
};
