import { FormEvent, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from './api';
import type {
  Artifact,
  Comment,
  Notification,
  User,
  VoteSummary,
} from './types';

const verdictText: Record<string, string> = {
  HARMLESS: 'text-emerald-700',
  SUSPICIOUS: 'text-amber-700',
  MALICIOUS: 'text-red-700',
  UNKNOWN: 'text-slate-500',
};

function Verdict({ value }: { value?: string | null }) {
  const verdict = value ?? 'UNKNOWN';
  return (
    <span className={`font-semibold ${verdictText[verdict] ?? verdictText.UNKNOWN}`}>
      {verdict}
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function shortHash(value?: string | null) {
  if (!value) return '—';
  return value.length > 34 ? `${value.slice(0, 24)}…${value.slice(-8)}` : value;
}

export default function App() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('session_token'),
  );
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [authBusy, setAuthBusy] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [forceRescan, setForceRescan] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [reusedScan, setReusedScan] = useState<boolean | null>(null);
  const [lastSubmissionVisibility, setLastSubmissionVisibility] =
    useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [votes, setVotes] = useState<VoteSummary | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const artifactId = artifact?.id ?? null;
  const isPublic = lastSubmissionVisibility === 'PUBLIC';

  useEffect(() => {
    if (!token) {
      setUser(null);
      setNotifications([]);
      return;
    }

    api
      .me(token)
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('session_token');
        setToken(null);
      });
  }, [token]);

  useEffect(() => {
    if (!token || !user) return;

    api.notifications(token).then(setNotifications).catch(() => undefined);

    const socket = io(window.location.origin, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('notification', (notification: Notification) => {
      setNotifications((current) => [
        notification,
        ...current.filter((item) => item.id !== notification.id),
      ]);
    });

    return () => {
      socket.disconnect();
    };
  }, [token, user]);

  useEffect(() => {
    if (!artifactId || !isPublic) {
      setComments([]);
      setVotes(null);
      return;
    }

    void refreshCommunity(artifactId);
  }, [artifactId, isPublic]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications],
  );

  const detections = useMemo(() => {
    const results = artifact?.latestScan?.engineResults ?? [];
    return {
      malicious: results.filter((result) => result.verdict === 'MALICIOUS').length,
      suspicious: results.filter((result) => result.verdict === 'SUSPICIOUS').length,
      total: results.length,
    };
  }, [artifact]);

  async function handleAuth(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setAuthBusy(true);

    try {
      if (authMode === 'register') {
        await api.register(authForm);
        setInfo('Account created. You can sign in now.');
        setAuthMode('login');
      } else {
        const result = await api.login({
          email: authForm.email,
          password: authForm.password,
        });
        localStorage.setItem('session_token', result.token);
        setToken(result.token);
        setUser(result.user);
        setInfo(`Signed in as ${result.user.username}.`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Authentication failed');
    } finally {
      setAuthBusy(false);
    }
  }

  async function logout() {
    if (token) {
      await api.logout(token).catch(() => undefined);
    }

    localStorage.removeItem('session_token');
    setToken(null);
    setUser(null);
    setNotifications([]);
    setVisibility('PUBLIC');
  }

  async function upload(event: FormEvent) {
    event.preventDefault();

    if (!file) {
      setError('Choose a file first.');
      return;
    }

    setError(null);
    setInfo(null);
    setUploadBusy(true);

    try {
      const result = await api.uploadFile(
        file,
        { visibility, forceRescan },
        token,
      );

      const fullArtifact = await api.artifact(result.artifact.id, token);
      setArtifact(fullArtifact);
      setReusedScan(result.reusedScan);
      setLastSubmissionVisibility(result.submission.visibility);
      setInfo(
        result.reusedScan
          ? 'A fresh existing result was reused.'
          : 'Scan completed.',
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Upload failed');
    } finally {
      setUploadBusy(false);
    }
  }

  async function refreshCommunity(id: string) {
    const [commentData, voteData] = await Promise.all([
      api.comments(id),
      api.votes(id),
    ]);
    setComments(commentData);
    setVotes(voteData);
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    if (!artifactId || !token) return;

    const body = commentBody.trim();
    if (!body) return;

    setError(null);

    try {
      await api.createComment(
        artifactId,
        {
          body,
          ...(replyTo ? { parentId: replyTo.id } : {}),
        },
        token,
      );
      setCommentBody('');
      setReplyTo(null);
      await refreshCommunity(artifactId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Comment failed');
    }
  }

  async function vote(value: 'HARMLESS' | 'SUSPICIOUS' | 'MALICIOUS') {
    if (!artifactId || !token) return;
    setError(null);

    try {
      await api.vote(artifactId, value, token);
      setVotes(await api.votes(artifactId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Vote failed');
    }
  }

  async function markRead(notification: Notification) {
    if (!token || notification.readAt) return;

    try {
      const updated = await api.markNotificationRead(notification.id, token);
      setNotifications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch {
      // Reading a notification should not block the rest of the interface.
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f8fa] text-[#24292f]">
      <header className="border-b border-[#d0d7de] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <a href="/" className="font-semibold tracking-tight text-[#24292f]">
              transcendence
            </a>
            <span className="hidden text-sm text-[#57606a] sm:inline">scanner</span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            {user ? (
              <>
                <span className="hidden text-[#57606a] sm:inline">
                  {user.username} · {user.role}
                  {unreadCount > 0 ? ` · ${unreadCount} unread` : ''}
                </span>
                <button className="link-button" onClick={logout}>
                  Sign out
                </button>
              </>
            ) : (
              <span className="text-[#57606a]">Anonymous</span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <section>
            <div className="border-b border-[#d0d7de] pb-3">
              <h1 className="text-xl font-semibold">Analyze a file</h1>
              <p className="mt-1 text-sm text-[#57606a]">
                Files are identified by SHA-256. Results remain reusable for seven days.
              </p>
            </div>

            <form onSubmit={upload} className="py-6">
              <label className="block border border-dashed border-[#8c959f] bg-white px-6 py-10 text-center">
                <input
                  type="file"
                  className="sr-only"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
                <div className="mx-auto max-w-md">
                  <p className="text-sm font-medium">
                    {file ? file.name : 'Drop a file here or choose a file'}
                  </p>
                  <p className="mt-1 text-xs text-[#6e7781]">
                    Maximum upload size: 25 MB
                  </p>
                  <span className="mt-4 inline-flex border border-[#8c959f] bg-[#f6f8fa] px-3 py-1.5 text-sm font-medium">
                    Choose file
                  </span>
                </div>
              </label>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-5 text-sm">
                  <label className="flex items-center gap-2">
                    <span className="text-[#57606a]">Visibility</span>
                    <select
                      className="control w-auto"
                      value={visibility}
                      onChange={(event) =>
                        setVisibility(event.target.value as 'PUBLIC' | 'PRIVATE')
                      }
                    >
                      <option value="PUBLIC">Public</option>
                      <option value="PRIVATE" disabled={!user}>
                        Private
                      </option>
                    </select>
                  </label>

                  <label className="flex items-center gap-2 text-[#57606a]">
                    <input
                      type="checkbox"
                      checked={forceRescan}
                      onChange={(event) => setForceRescan(event.target.checked)}
                    />
                    Force rescan
                  </label>
                </div>

                <button className="primary-button" disabled={uploadBusy || !file}>
                  {uploadBusy ? 'Scanning…' : 'Scan file'}
                </button>
              </div>
            </form>
          </section>

          {(error || info) && (
            <div
              className={`mb-6 border px-4 py-3 text-sm ${
                error
                  ? 'border-red-300 bg-red-50 text-red-800'
                  : 'border-[#b6d7a8] bg-[#f0f8ed] text-[#386641]'
              }`}
            >
              {error ?? info}
            </div>
          )}

          {artifact ? (
            <section className="border-t border-[#d0d7de] pt-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">
                    {artifact.file?.mimeType ?? artifact.type}
                  </h2>
                  <p className="mt-1 break-all font-mono text-xs text-[#6e7781]">
                    {artifact.id}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <div>
                    Verdict: <Verdict value={artifact.latestScan?.overallVerdict} />
                  </div>
                  {reusedScan !== null && (
                    <div className="mt-1 text-xs text-[#6e7781]">
                      {reusedScan ? 'cached result' : 'new scan'}
                    </div>
                  )}
                </div>
              </div>

              {artifact.file && (
                <dl className="mt-6 grid border-y border-[#d0d7de] bg-white sm:grid-cols-[130px_1fr]">
                  {[
                    ['SHA-256', artifact.file.sha256],
                    ['SHA-1', artifact.file.sha1 ?? '—'],
                    ['MD5', artifact.file.md5 ?? '—'],
                    ['Size', `${artifact.file.size} bytes`],
                  ].map(([label, value]) => (
                    <div className="contents" key={label}>
                      <dt className="border-b border-[#d8dee4] bg-[#f6f8fa] px-3 py-2 text-xs font-medium text-[#57606a] last:border-b-0">
                        {label}
                      </dt>
                      <dd className="border-b border-[#d8dee4] px-3 py-2 font-mono text-xs break-all last:border-b-0">
                        {label.startsWith('SHA') ? shortHash(value) : value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              <div className="mt-7">
                <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#d0d7de] pb-3">
                  <div>
                    <h3 className="font-semibold">Detection</h3>
                    <p className="mt-1 text-sm text-[#57606a]">
                      {detections.total
                        ? `${detections.malicious} malicious, ${detections.suspicious} suspicious out of ${detections.total} engines`
                        : 'No engine results'}
                    </p>
                  </div>
                  {artifact.latestScan && (
                    <div className="text-xs text-[#6e7781]">
                      Updated {formatDate(artifact.latestScan.completedAt)}
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto bg-white">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#d0d7de] text-xs text-[#57606a]">
                        <th className="px-3 py-2 font-medium">Engine</th>
                        <th className="px-3 py-2 font-medium">Result</th>
                        <th className="px-3 py-2 font-medium">Detection</th>
                      </tr>
                    </thead>
                    <tbody>
                      {artifact.latestScan?.engineResults?.length ? (
                        artifact.latestScan.engineResults.map((result) => (
                          <tr
                            key={result.engine}
                            className="border-b border-[#eaeef2] last:border-b-0"
                          >
                            <td className="px-3 py-3 font-medium">{result.engine}</td>
                            <td className="px-3 py-3">
                              <Verdict value={result.verdict} />
                            </td>
                            <td className="px-3 py-3 text-[#57606a]">
                              {result.detectionName ?? '—'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-3 py-4 text-[#57606a]" colSpan={3}>
                            No engine results.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {artifact.latestScan && (
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#6e7781]">
                    <span>Reason: {artifact.latestScan.reason}</span>
                    <span>Fresh until: {formatDate(artifact.latestScan.staleAt)}</span>
                  </div>
                )}
              </div>
            </section>
          ) : (
            <div className="border-t border-[#d0d7de] py-10 text-center text-sm text-[#6e7781]">
              Scan a file to view its hashes and engine results.
            </div>
          )}

          {artifact && isPublic && (
            <section className="mt-10 border-t border-[#d0d7de] pt-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d0d7de] pb-3">
                <div>
                  <h2 className="font-semibold">Community</h2>
                  <p className="mt-1 text-sm text-[#57606a]">
                    Comments and community verdict for this public artifact.
                  </p>
                </div>

                <div className="flex gap-1 text-xs">
                  {(
                    [
                      ['HARMLESS', 'Harmless'],
                      ['SUSPICIOUS', 'Suspicious'],
                      ['MALICIOUS', 'Malicious'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      disabled={!user}
                      onClick={() => vote(value)}
                      className="secondary-button px-2.5 py-1.5"
                    >
                      {label} {votes?.counts[value] ?? 0}
                    </button>
                  ))}
                </div>
              </div>

              {user ? (
                <form className="border-b border-[#d0d7de] py-4" onSubmit={submitComment}>
                  {replyTo && (
                    <div className="mb-2 flex items-center justify-between bg-[#f6f8fa] px-3 py-2 text-xs text-[#57606a]">
                      <span>Replying to {replyTo.user.username}</span>
                      <button type="button" className="link-button" onClick={() => setReplyTo(null)}>
                        Cancel
                      </button>
                    </div>
                  )}
                  <textarea
                    className="control min-h-24 resize-y"
                    placeholder="Add a comment…"
                    value={commentBody}
                    maxLength={4000}
                    onChange={(event) => setCommentBody(event.target.value)}
                  />
                  <div className="mt-2 flex justify-end">
                    <button className="primary-button">Comment</button>
                  </div>
                </form>
              ) : (
                <div className="border-b border-[#d0d7de] py-4 text-sm text-[#57606a]">
                  Sign in to comment or vote.
                </div>
              )}

              <div>
                {comments.length ? (
                  comments.map((comment) => (
                    <article
                      key={comment.id}
                      className={`border-b border-[#eaeef2] py-4 ${
                        comment.parentId ? 'ml-6 border-l-2 border-l-[#d0d7de] pl-4 sm:ml-10' : ''
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="text-sm">
                          <span className="font-semibold">{comment.user.username}</span>
                          {comment.user.role && comment.user.role !== 'USER' && (
                            <span className="ml-2 text-xs text-[#6e7781]">
                              {comment.user.role}
                            </span>
                          )}
                        </div>
                        <time className="text-xs text-[#8c959f]">
                          {formatDate(comment.createdAt)}
                        </time>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                        {comment.body}
                      </p>
                      {user && (
                        <button
                          type="button"
                          className="link-button mt-2 text-xs"
                          onClick={() => setReplyTo(comment)}
                        >
                          Reply
                        </button>
                      )}
                    </article>
                  ))
                ) : (
                  <p className="py-6 text-sm text-[#6e7781]">No comments yet.</p>
                )}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-8">
          {!user && (
            <section className="border border-[#d0d7de] bg-white">
              <div className="flex border-b border-[#d0d7de]">
                {(['login', 'register'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAuthMode(mode)}
                    className={`flex-1 px-3 py-2.5 text-sm ${
                      authMode === mode
                        ? 'border-b-2 border-b-[#0969da] font-semibold text-[#24292f]'
                        : 'text-[#57606a]'
                    }`}
                  >
                    {mode === 'login' ? 'Sign in' : 'Register'}
                  </button>
                ))}
              </div>

              <form className="space-y-3 p-4" onSubmit={handleAuth}>
                {authMode === 'register' && (
                  <input
                    className="control"
                    placeholder="Username"
                    value={authForm.username}
                    onChange={(event) =>
                      setAuthForm((current) => ({
                        ...current,
                        username: event.target.value,
                      }))
                    }
                  />
                )}
                <input
                  className="control"
                  type="email"
                  placeholder="Email"
                  value={authForm.email}
                  onChange={(event) =>
                    setAuthForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
                <input
                  className="control"
                  type="password"
                  placeholder="Password"
                  value={authForm.password}
                  onChange={(event) =>
                    setAuthForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                />
                <button className="primary-button w-full" disabled={authBusy}>
                  {authBusy
                    ? 'Please wait…'
                    : authMode === 'login'
                      ? 'Sign in'
                      : 'Create account'}
                </button>
              </form>
            </section>
          )}

          {user && (
            <section>
              <div className="flex items-center justify-between border-b border-[#d0d7de] pb-2">
                <h2 className="text-sm font-semibold">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="text-xs font-medium text-[#0969da]">
                    {unreadCount} unread
                  </span>
                )}
              </div>

              <div>
                {notifications.length ? (
                  notifications.slice(0, 8).map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => markRead(notification)}
                      className={`block w-full border-b border-[#eaeef2] py-3 text-left ${
                        notification.readAt ? 'opacity-70' : ''
                      }`}
                    >
                      <div className="text-xs font-medium text-[#57606a]">
                        {notification.type.replace(/_/g, ' ')}
                      </div>
                      <div className="mt-1 text-sm">
                        {notification.message ?? 'New notification'}
                      </div>
                      <div className="mt-1 text-xs text-[#8c959f]">
                        {formatDate(notification.createdAt)}
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="py-4 text-sm text-[#6e7781]">No notifications.</p>
                )}
              </div>
            </section>
          )}

          <section className="border-t border-[#d0d7de] pt-4 text-xs leading-5 text-[#6e7781]">
            <p>
              Public submissions can appear in community features. Private submissions
              require an account and are excluded from public discussion.
            </p>
          </section>
        </aside>
      </main>
    </div>
  );
}
