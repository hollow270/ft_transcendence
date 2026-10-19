import type {
  Artifact,
  Comment,
  Notification,
  UploadResponse,
  User,
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

  login(payload: { email: string; password: string }) {
    return request<{
      token: string;
      tokenType: string;
      expiresAt: string;
      user: User;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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

  artifact(artifactId: string, token?: string | null) {
    return request<Artifact>(
      `/artifacts/${encodeURIComponent(artifactId)}`,
      {},
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
