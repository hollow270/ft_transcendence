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

const verdictClasses: Record<string, string> = {
  HARMLESS: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  SUSPICIOUS: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  MALICIOUS: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  UNKNOWN: 'border-slate-600 bg-slate-800 text-slate-300',
};

function VerdictBadge({ verdict }: { verdict?: string | null }) {
  const value = verdict ?? 'UNKNOWN';
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold tracking-wide ${
        verdictClasses[value] ?? verdictClasses.UNKNOWN
      }`}
    >
      {value}
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function shortHash(value?: string | null) {
  if (!value) return '—';
  return value.length > 24 ? `${value.slice(0, 18)}…${value.slice(-6)}` : value;
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

    return () => socket.disconnect();
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

  async function handleAuth(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setAuthBusy(true);

    try {
      if (authMode === 'register') {
        await api.register(authForm);
        setInfo('Account created. Sign in to continue.');
        setAuthMode('login');
      } else {
        const result = await api.login({
          email: authForm.email,
          password: authForm.password,
        });
        localStorage.setItem('session_token', result.token);
        setToken(result.token);
        setUser(result.user);
        setInfo(`Welcome back, ${result.user.username}.`);
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
          ? 'Existing fresh scan reused.'
          : 'New scan completed and stored.',
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

  async function vote(verdict: 'HARMLESS' | 'SUSPICIOUS' | 'MALICIOUS') {
    if (!artifactId || !token) return;
    setError(null);

    try {
      await api.vote(artifactId, verdict, token);
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
      // Notification acknowledgement should not interrupt the main UI.
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400">
              ft_transcendence
            </p>
            <h1 className="text-xl font-bold text-white">Artifact Scanner</h1>
          </div>

          <div className="flex items-center gap-3 text-sm">
            {user ? (
              <>
                <div className="hidden text-right sm:block">
                  <p className="font-semibold text-white">{user.username}</p>
                  <p className="text-xs text-slate-400">
                    {user.role} · {unreadCount} unread
                  </p>
                </div>
                <button className="btn-secondary" onClick={logout}>
                  Sign out
                </button>
              </>
            ) : (
              <span className="rounded-full border border-slate-800 px-3 py-1.5 text-xs text-slate-400">
                Anonymous mode
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
        <div className="space-y-6">
          <section className="panel overflow-hidden">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <span className="inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                  FILE ANALYSIS
                </span>
                <h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Scan once. Reuse trusted artifact history.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                  Files are identified by SHA-256. Fresh results can be reused for
                  seven days, while registered users can keep submissions private
                  or request a manual rescan.
                </p>
              </div>

              <form className="space-y-4" onSubmit={upload}>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">
                    File
                  </span>
                  <input
                    className="field file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-slate-950"
                    type="file"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label>
                    <span className="mb-2 block text-sm font-medium text-slate-300">
                      Visibility
                    </span>
                    <select
                      className="field"
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

                  <label className="flex items-end">
                    <span className="flex h-[42px] w-full items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={forceRescan}
                        onChange={(event) => setForceRescan(event.target.checked)}
                        className="h-4 w-4 accent-cyan-500"
                      />
                      Force rescan
                    </span>
                  </label>
                </div>

                <button className="btn-primary w-full" disabled={uploadBusy}>
                  {uploadBusy ? 'Scanning…' : 'Upload and scan'}
                </button>
              </form>
            </div>
          </section>

          {(error || info) && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                error
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                  : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
              }`}
            >
              {error ?? info}
            </div>
          )}

          {artifact ? (
            <section className="panel">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Artifact
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-white">
                    {artifact.file?.mimeType ?? artifact.type}
                  </h2>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    {artifact.id}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {reusedScan !== null && (
                    <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-400">
                      {reusedScan ? 'Cached result' : 'New scan'}
                    </span>
                  )}
                  <VerdictBadge verdict={artifact.latestScan?.overallVerdict} />
                </div>
              </div>

              {artifact.file && (
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {[
                    ['SHA-256', shortHash(artifact.file.sha256)],
                    ['SHA-1', shortHash(artifact.file.sha1)],
                    ['MD5', artifact.file.md5 ?? '—'],
                    ['Size', `${artifact.file.size} bytes`],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"
                    >
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        {label}
                      </p>
                      <p className="mt-1 break-all font-mono text-sm text-slate-200">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6">
                <h3 className="font-semibold text-white">Scan engines</h3>
                <div className="mt-3 overflow-hidden rounded-xl border border-slate-800">
                  <div className="grid grid-cols-[1fr_auto] bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <span>Engine / detection</span>
                    <span>Verdict</span>
                  </div>
                  {artifact.latestScan?.engineResults?.length ? (
                    artifact.latestScan.engineResults.map((result) => (
                      <div
                        key={result.engine}
                        className="grid grid-cols-[1fr_auto] items-center gap-4 border-t border-slate-800 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-200">
                            {result.engine}
                          </p>
                          <p className="text-xs text-slate-500">
                            {result.detectionName ?? 'No named detection'}
                          </p>
                        </div>
                        <VerdictBadge verdict={result.verdict} />
                      </div>
                    ))
                  ) : (
                    <p className="border-t border-slate-800 px-4 py-4 text-sm text-slate-500">
                      No engine results.
                    </p>
                  )}
                </div>

                {artifact.latestScan && (
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                    <span>Reason: {artifact.latestScan.reason}</span>
                    <span>Completed: {formatDate(artifact.latestScan.completedAt)}</span>
                    <span>Fresh until: {formatDate(artifact.latestScan.staleAt)}</span>
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section className="panel border-dashed text-center">
              <p className="text-sm text-slate-500">
                Upload a file to see its artifact, scan and engine results here.
              </p>
            </section>
          )}

          {artifact && isPublic && (
            <section className="panel">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white">Community</h2>
                  <p className="text-sm text-slate-500">
                    Discuss the public artifact and add one community verdict.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
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
                      className="btn-secondary px-3 py-2 text-xs"
                    >
                      {label}{' '}
                      <span className="ml-1 text-slate-500">
                        {votes?.counts[value] ?? 0}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {user ? (
                <form className="mt-5 space-y-2" onSubmit={submitComment}>
                  {replyTo && (
                    <div className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-400">
                      <span>Replying to {replyTo.user.username}</span>
                      <button type="button" onClick={() => setReplyTo(null)}>
                        Cancel
                      </button>
                    </div>
                  )}
                  <textarea
                    className="field min-h-24 resize-y"
                    placeholder="Add useful context about this artifact…"
                    value={commentBody}
                    maxLength={4000}
                    onChange={(event) => setCommentBody(event.target.value)}
                  />
                  <button className="btn-primary">Post comment</button>
                </form>
              ) : (
                <p className="mt-5 rounded-xl bg-slate-950 p-3 text-sm text-slate-500">
                  Sign in to comment or vote.
                </p>
              )}

              <div className="mt-6 space-y-3">
                {comments.length ? (
                  comments.map((comment) => (
                    <article
                      key={comment.id}
                      className={`rounded-xl border border-slate-800 bg-slate-950/60 p-4 ${
                        comment.parentId ? 'ml-6 sm:ml-10' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-200">
                          {comment.user.username}
                        </p>
                        <p className="text-xs text-slate-600">
                          {formatDate(comment.createdAt)}
                        </p>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                        {comment.body}
                      </p>
                      {user && (
                        <button
                          type="button"
                          className="mt-2 text-xs font-semibold text-cyan-400 hover:text-cyan-300"
                          onClick={() => setReplyTo(comment)}
                        >
                          Reply
                        </button>
                      )}
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No comments yet.</p>
                )}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          {!user && (
            <section className="panel">
              <div className="flex rounded-xl bg-slate-950 p-1">
                {(['login', 'register'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAuthMode(mode)}
                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide transition ${
                      authMode === mode
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <form className="mt-4 space-y-3" onSubmit={handleAuth}>
                {authMode === 'register' && (
                  <input
                    className="field"
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
                  className="field"
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
                  className="field"
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
                <button className="btn-primary w-full" disabled={authBusy}>
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
            <section className="panel">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-white">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-cyan-500 px-2 py-0.5 text-xs font-bold text-slate-950">
                    {unreadCount}
                  </span>
                )}
              </div>

              <div className="mt-4 space-y-2">
                {notifications.length ? (
                  notifications.slice(0, 8).map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => markRead(notification)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        notification.readAt
                          ? 'border-slate-800 bg-slate-950/40'
                          : 'border-cyan-500/20 bg-cyan-500/5'
                      }`}
                    >
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        {notification.type.replaceAll('_', ' ')}
                      </p>
                      <p className="mt-1 text-sm text-slate-300">
                        {notification.message ?? 'New notification'}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {formatDate(notification.createdAt)}
                      </p>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No notifications yet.</p>
                )}
              </div>
            </section>
          )}

          <section className="panel">
            <h2 className="font-bold text-white">Current backend slice</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              <li>✓ Authentication and sessions</li>
              <li>✓ SHA-256 artifact deduplication</li>
              <li>✓ Public / private submissions</li>
              <li>✓ 7-day scan reuse + manual rescan</li>
              <li>✓ Engine result storage</li>
              <li>✓ Real-time notifications</li>
              <li>✓ Comments and community votes</li>
            </ul>
          </section>
        </aside>
      </main>
    </div>
  );
}
