import type {
  AdvancedSearchResponse,
  AdvancedSearchSort,
  Artifact,
  AdminActivityPoint,
  AdminOverview,
  ApiKeyInfo,
  ArtifactScanHistoryItem,
  Comment,
  CreatedApiKey,
  CommentReportReason,
  HistoryItem,
  ModerationReport,
  Notification,
  ScannerCapabilities,
  SearchResult,
  UploadResponse,
  UrlSubmissionResponse,
  User,
  UserCommunity,
  VoteSummary,
} from './types';

const API_BASE = '/api';

type AiStreamPayload =
  | { event: 'start' }
  | { event: 'delta'; text: string }
  | { event: 'complete'; status: 'COMPLETE' }
  | { event: 'error'; code?: string; message: string };

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      data?.message ??
      data?.error ??
      `Request failed with status ${response.status}`;
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }

  return data as T;
}

async function streamAi(
  path: string,
  payload: unknown,
  token: string,
  onDelta: (text: string) => void,
) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    let message = `AI request failed with status ${response.status}`;

    try {
      const parsed = JSON.parse(body);
      message = parsed?.message ?? parsed?.error ?? message;
    } catch {
      // Keep the generic message when the body is not JSON.
    }

    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }

  if (!response.body) {
    throw new Error('AI stream is not available in this browser.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let complete = false;

  const processFrame = (frame: string) => {
    const dataLines = frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim());

    for (const raw of dataLines) {
      if (!raw) continue;

      const event = JSON.parse(raw) as AiStreamPayload;

      if (event.event === 'delta') {
        onDelta(event.text);
      }

      if (event.event === 'error') {
        throw new Error(event.message);
      }

      if (event.event === 'complete') {
        complete = true;
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();

    if (value) {
      buffer += decoder.decode(value, { stream: !done });
    }

    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      processFrame(frame);
    }

    if (done) break;
  }

  if (buffer.trim()) {
    processFrame(buffer);
  }

  if (!complete) {
    throw new Error('AI stream ended before completion.');
  }
}

export const api = {
  register(payload: {
    username: string;
    email: string;
    password: string;
  }) {
    return request<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  login(payload: {
    email: string;
    password: string;
    totpCode?: string;
  }) {
    return request<
      | { requiresTwoFactor: true }
      | {
          requiresTwoFactor: false;
          token: string;
          tokenType: string;
          expiresAt: string;
          user: User;
        }
    >('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  twoFactorStatus(token: string) {
    return request<{
      enabled: boolean;
      configured: boolean;
    }>('/auth/2fa/status', {}, token);
  },

  setupTwoFactor(token: string) {
    return request<{
      secret: string;
      otpauthUri: string;
    }>(
      '/auth/2fa/setup',
      { method: 'POST' },
      token,
    );
  },

  enableTwoFactor(code: string, token: string) {
    return request<{ enabled: boolean }>(
      '/auth/2fa/enable',
      {
        method: 'POST',
        body: JSON.stringify({ code }),
      },
      token,
    );
  },

  disableTwoFactor(code: string, token: string) {
    return request<{ enabled: boolean }>(
      '/auth/2fa/disable',
      {
        method: 'POST',
        body: JSON.stringify({ code }),
      },
      token,
    );
  },

  me(token: string) {
    return request<User>('/auth/me', {}, token);
  },

  logout(token: string) {
    return request<{ success: boolean }>(
      '/auth/logout',
      { method: 'POST' },
      token,
    );
  },

  scannerCapabilities() {
    return request<ScannerCapabilities>('/artifacts/scanner/capabilities');
  },

  searchArtifactsAdvanced(input: {
    query?: string;
    type?: 'FILE' | 'URL' | '';
    verdict?:
      | 'UNKNOWN'
      | 'HARMLESS'
      | 'SUSPICIOUS'
      | 'MALICIOUS'
      | '';
    sort?: AdvancedSearchSort;
    page?: number;
    pageSize?: number;
  }) {
    const params = new URLSearchParams();

    if (input.query?.trim()) {
      params.set('q', input.query.trim());
    }
    if (input.type) {
      params.set('type', input.type);
    }
    if (input.verdict) {
      params.set('verdict', input.verdict);
    }
    if (input.sort) {
      params.set('sort', input.sort);
    }
    if (input.page) {
      params.set('page', String(input.page));
    }
    if (input.pageSize) {
      params.set(
        'pageSize',
        String(input.pageSize),
      );
    }

    return request<AdvancedSearchResponse>(
      '/artifacts/search/advanced?' +
        params.toString(),
    );
  },

  searchArtifacts(query: string) {
    return request<SearchResult[]>(
      '/artifacts/search?q=' +
        encodeURIComponent(query),
    );
  },

  history(token: string) {
    return request<HistoryItem[]>(
      '/users/me/history',
      {},
      token,
    );
  },



  uploadFile(
    file: File,
    options: {
      visibility: 'PUBLIC' | 'PRIVATE';
      forceRescan: boolean;
    },
    token?: string | null,
  ) {
    const form = new FormData();
    form.set('file', file);
    form.set('visibility', options.visibility);
    form.set('forceRescan', String(options.forceRescan));

    return request<UploadResponse>(
      '/artifacts/files',
      {
        method: 'POST',
        body: form,
      },
      token,
    );
  },

  submitUrl(
    url: string,
    options: {
      visibility: 'PUBLIC' | 'PRIVATE';
      forceRescan: boolean;
    },
    token?: string | null,
  ) {
    return request<UrlSubmissionResponse>(
      '/artifacts/urls',
      {
        method: 'POST',
        body: JSON.stringify({
          url,
          visibility: options.visibility,
          forceRescan: options.forceRescan,
        }),
      },
      token,
    );
  },

  artifact(artifactId: string, token?: string | null) {
    return request<Artifact>(
      `/artifacts/${encodeURIComponent(artifactId)}`,
      {},
      token,
    );
  },

  artifactScanHistory(artifactId: string, token?: string | null) {
    return request<ArtifactScanHistoryItem[]>(
      `/artifacts/${encodeURIComponent(artifactId)}/scans`,
      {},
      token,
    );
  },

  rescanArtifact(artifactId: string, token: string) {
    return request<Artifact['latestScan']>(
      `/artifacts/${encodeURIComponent(artifactId)}/rescan`,
      { method: 'POST' },
      token,
    );
  },

  refreshArtifactScan(artifactId: string, token?: string | null) {
    return request<Artifact['latestScan']>(
      `/artifacts/${encodeURIComponent(artifactId)}/refresh`,
      { method: 'POST' },
      token,
    );
  },

  comments(artifactId: string) {
    return request<Comment[]>(
      `/artifacts/${encodeURIComponent(artifactId)}/comments`,
    );
  },

  createComment(
    artifactId: string,
    payload: { body: string; parentId?: string },
    token: string,
  ) {
    return request<Comment>(
      `/artifacts/${encodeURIComponent(artifactId)}/comments`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  votes(artifactId: string) {
    return request<VoteSummary>(
      `/artifacts/${encodeURIComponent(artifactId)}/votes`,
    );
  },

  editComment(
    artifactId: string,
    commentId: string,
    body: string,
    token: string,
  ) {
    return request<Comment>(
      '/artifacts/' +
        encodeURIComponent(artifactId) +
        '/comments/' +
        encodeURIComponent(commentId),
      {
        method: 'PATCH',
        body: JSON.stringify({ body }),
      },
      token,
    );
  },

  deleteComment(
    artifactId: string,
    commentId: string,
    token: string,
  ) {
    return request<{ success: boolean }>(
      '/artifacts/' +
        encodeURIComponent(artifactId) +
        '/comments/' +
        encodeURIComponent(commentId),
      {
        method: 'DELETE',
      },
      token,
    );
  },

  reportComment(
    artifactId: string,
    commentId: string,
    payload: {
      reason: CommentReportReason;
      details?: string;
    },
    token: string,
  ) {
    return request(
      '/artifacts/' +
        encodeURIComponent(artifactId) +
        '/comments/' +
        encodeURIComponent(commentId) +
        '/report',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  moderationReports(
    status: 'OPEN' | 'REVIEWING' | 'RESOLVED' | 'REJECTED',
    token: string,
  ) {
    return request<ModerationReport[]>(
      '/moderation/reports?status=' +
        encodeURIComponent(status),
      {},
      token,
    );
  },

  resolveModerationReport(
    reportId: string,
    payload: {
      action:
        | 'HIDE_COMMENT'
        | 'DELETE_COMMENT'
        | 'BAN_COMMENTING'
        | 'NO_ACTION';
      reason?: string;
      banDays?: number;
    },
    token: string,
  ) {
    return request<{
      id: string;
      status: string;
      reviewedAt: string;
      action: string;
    }>(
      '/moderation/reports/' +
        encodeURIComponent(reportId) +
        '/resolve',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  vote(
    artifactId: string,
    verdict: 'HARMLESS' | 'SUSPICIOUS' | 'MALICIOUS',
    token: string,
  ) {
    return request(
      `/artifacts/${encodeURIComponent(artifactId)}/vote`,
      {
        method: 'PUT',
        body: JSON.stringify({ verdict }),
      },
      token,
    );
  },

  userCommunity(userId: string, token?: string | null) {
    return request<UserCommunity>(
      `/users/${encodeURIComponent(userId)}/community`,
      {},
      token,
    );
  },

  adminOverview(token: string) {
    return request<AdminOverview>(
      '/admin/overview',
      {},
      token,
    );
  },

  adminActivity(
    days: number,
    token: string,
  ) {
    return request<AdminActivityPoint[]>(
      '/admin/activity?days=' +
        encodeURIComponent(String(days)),
      {},
      token,
    );
  },

  async adminExportCsv(token: string) {
    const response = await fetch(
      API_BASE + '/admin/export.csv',
      {
        headers: {
          Authorization: 'Bearer ' + token,
        },
      },
    );

    if (!response.ok) {
      const text = await response.text();
      let message =
        'Admin export failed with status ' +
        response.status;

      try {
        const data = text
          ? JSON.parse(text)
          : null;
        message =
          data?.message ??
          data?.error ??
          message;
      } catch {
        // Keep generic message for non-JSON responses.
      }

      throw new Error(
        Array.isArray(message)
          ? message.join(', ')
          : message,
      );
    }

    return response.blob();
  },

  apiKeys(token: string) {
    return request<ApiKeyInfo[]>(
      '/api-keys',
      {},
      token,
    );
  },

  createApiKey(
    name: string,
    token: string,
  ) {
    return request<CreatedApiKey>(
      '/api-keys',
      {
        method: 'POST',
        body: JSON.stringify({ name }),
      },
      token,
    );
  },

  revokeApiKey(
    apiKeyId: string,
    token: string,
  ) {
    return request<{ success: boolean }>(
      '/api-keys/' +
        encodeURIComponent(apiKeyId),
      {
        method: 'DELETE',
      },
      token,
    );
  },

  notifications(token: string) {
    return request<Notification[]>('/notifications', {}, token);
  },

  markNotificationRead(notificationId: string, token: string) {
    return request<Notification>(
      `/notifications/${encodeURIComponent(notificationId)}/read`,
      { method: 'PATCH' },
      token,
    );
  },

  askAi(
    prompt: string,
    token: string,
    onDelta: (text: string) => void,
  ) {
    return streamAi('/ai/ask', { prompt }, token, onDelta);
  },

  explainScan(
    scanId: string,
    token: string,
    onDelta: (text: string) => void,
  ) {
    return streamAi('/ai/scans/explain', { scanId }, token, onDelta);
  },
};
