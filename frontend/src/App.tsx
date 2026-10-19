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
  HARMLESS: 'text-emerald-400',
  SUSPICIOUS: 'text-amber-400',
  MALICIOUS: 'text-red-400',
  UNKNOWN: 'text-slate-400',
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

function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 160 160"
      role="img"
      aria-label="GO VIRUS logo"
    >
      <defs>
        <linearGradient id="brand-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="55%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#84cc16" />
        </linearGradient>
        <linearGradient id="brand-b" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a3e635" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>

      <circle cx="80" cy="80" r="62" fill="none" stroke="#17365f" strokeWidth="6" />
      <circle cx="80" cy="80" r="50" fill="none" stroke="#155e75" strokeWidth="2" />
      <circle cx="80" cy="80" r="37" fill="none" stroke="#164e63" strokeWidth="2" />

      <path
        d="M34 54 L55 54 L80 90 L106 54 L128 54 L80 126 Z"
        fill="none"
        stroke="url(#brand-a)"
        strokeWidth="10"
        strokeLinejoin="round"
      />
      <path
        d="M48 42 L80 82 L122 32"
        fill="none"
        stroke="url(#brand-b)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <g fill="#22d3ee">
        <circle cx="26" cy="74" r="4" />
        <circle cx="132" cy="72" r="4" />
        <circle cx="52" cy="22" r="3" />
        <circle cx="108" cy="136" r="3" />
      </g>
      <g fill="#84cc16">
        <circle cx="43" cy="121" r="4" />
        <circle cx="120" cy="42" r="4" />
      </g>
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function FileScanIcon() {
  return (
    <svg
      viewBox="0 0 120 120"
      className="mx-auto h-28 w-28 text-slate-300"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
    >
      <path d="M34 16h35l18 18v70H34z" />
      <path d="M69 16v20h18" />
      <path d="M18 59h84" stroke="#38bdf8" strokeWidth="4" />
      <path d="M50 82c0-10 20-10 20 0 0 5-4 8-4 13" />
      <path d="M44 82c0-18 32-18 32 0 0 9-7 13-7 22" />
      <path d="M55 94c0-5 10-5 10 0" />
    </svg>
  );
}

export default function App() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('session_token'),
  );
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null);
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

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const artifactId = artifact?.id ?? null;
  const isPublic = lastSubmissionVisibility === 'PUBLIC';

  useEffect(() => {
    setAiAnswer('');
    setAiError(null);
  }, [artifactId]);

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
    if (!authMode) return;

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
        setAuthMode(null);
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
      setInfo(result.reusedScan ? 'Fresh existing result reused.' : 'Scan completed.');
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
      // Keep the rest of the page usable if this request fails.
    }
  }

  async function explainCurrentScan() {
    const scanId = artifact?.latestScan?.id;
    if (!token || !scanId) return;

    setAiBusy(true);
    setAiAnswer('');
    setAiError(null);

    try {
      await api.explainScan(scanId, token, (text) => {
        setAiAnswer((current) => current + text);
      });
    } catch (caught) {
      setAiError(
        caught instanceof Error ? caught.message : 'AI explanation failed.',
      );
    } finally {
      setAiBusy(false);
    }
  }

  async function askAi(event: FormEvent) {
    event.preventDefault();
    if (!token || !aiPrompt.trim()) return;

    setAiBusy(true);
    setAiAnswer('');
    setAiError(null);

    try {
      await api.askAi(aiPrompt.trim(), token, (text) => {
        setAiAnswer((current) => current + text);
      });
    } catch (caught) {
      setAiError(
        caught instanceof Error ? caught.message : 'AI request failed.',
      );
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b1020] text-slate-100">
      <header className="border-b border-[#243455] bg-[#17223b]">
        <div className="flex h-16 items-center gap-4 px-4 lg:px-6">
          <div className="flex shrink-0 items-center gap-2">
            <BrandMark className="h-11 w-11" />
            <span className="hidden text-lg font-bold tracking-wide sm:block">
              <span className="text-cyan-300">GO</span>{' '}
              <span className="text-lime-300">VIRUS</span>
            </span>
          </div>

          <div className="mx-auto flex max-w-4xl flex-1 items-center rounded-md border border-[#34486e] bg-[#111a30] px-4 text-slate-400">
            <SearchIcon />
            <input
              className="w-full bg-transparent px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-500"
              placeholder="URL, IP address, domain or file hash"
              aria-label="Search"
            />
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            {user ? (
              <>
                <button
                  type="button"
                  className="hidden text-sm text-slate-300 hover:text-white sm:block"
                >
                  {user.username}
                  {unreadCount ? ` (${unreadCount})` : ''}
                </button>
                <button className="nav-link" onClick={logout}>Sign out</button>
              </>
            ) : (
              <>
                <button className="nav-link" onClick={() => setAuthMode('login')}>
                  Sign in
                </button>
                <button className="signup-button" onClick={() => setAuthMode('register')}>
                  Sign up
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {authMode && !user && (
        <div className="fixed inset-0 z-40 flex items-start justify-end bg-black/45 p-4 pt-20" onClick={() => setAuthMode(null)}>
          <section
            className="w-full max-w-sm border border-[#304568] bg-[#111a2d] p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {authMode === 'login' ? 'Sign in' : 'Create account'}
              </h2>
              <button className="text-slate-400 hover:text-white" onClick={() => setAuthMode(null)}>
                ×
              </button>
            </div>
            <form className="space-y-3" onSubmit={handleAuth}>
              {authMode === 'register' && (
                <input
                  className="dark-control"
                  placeholder="Username"
                  value={authForm.username}
                  onChange={(event) =>
                    setAuthForm((current) => ({ ...current, username: event.target.value }))
                  }
                />
              )}
              <input
                className="dark-control"
                type="email"
                placeholder="Email"
                value={authForm.email}
                onChange={(event) =>
                  setAuthForm((current) => ({ ...current, email: event.target.value }))
                }
              />
              <input
                className="dark-control"
                type="password"
                placeholder="Password"
                value={authForm.password}
                onChange={(event) =>
                  setAuthForm((current) => ({ ...current, password: event.target.value }))
                }
              />
              <button className="scan-button w-full" disabled={authBusy}>
                {authBusy ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Sign up'}
              </button>
            </form>
          </section>
        </div>
      )}

      <main>
        <section className="hero-grid relative overflow-hidden border-b border-[#1d2b48]">
          <div className="mx-auto max-w-5xl px-4 pb-14 pt-10 text-center sm:pt-12">
            <BrandMark className="mx-auto h-40 w-40 sm:h-48 sm:w-48" />

            <h1 className="mt-1 text-5xl font-bold tracking-[0.08em] sm:text-6xl">
              <span className="text-slate-100">GO </span>
              <span className="bg-gradient-to-r from-cyan-300 via-cyan-400 to-lime-300 bg-clip-text text-transparent">
                VIRUS
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Analyse suspicious files to detect malware and other security threats,
              and share results with the security community.
            </p>

            <div className="mx-auto mt-10 max-w-3xl">
              <div className="border-b border-[#445473] pb-3 text-sm font-semibold tracking-wide text-[#8eb7ff]">
                FILE
              </div>

              <form onSubmit={upload} className="pt-8">
                <label className="mx-auto block w-fit cursor-pointer">
                  <input
                    type="file"
                    className="sr-only"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  />
                  <FileScanIcon />
                  <span className="choose-button mt-3">
                    {file ? file.name : 'Choose file'}
                  </span>
                </label>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-5 text-xs text-slate-400">
                  <label className="flex items-center gap-2">
                    <span>Visibility</span>
                    <select
                      className="dark-select"
                      value={visibility}
                      onChange={(event) =>
                        setVisibility(event.target.value as 'PUBLIC' | 'PRIVATE')
                      }
                    >
                      <option value="PUBLIC">Public</option>
                      <option value="PRIVATE" disabled={!user}>Private</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={forceRescan}
                      onChange={(event) => setForceRescan(event.target.checked)}
                    />
                    Force rescan
                  </label>

                  <button className="scan-button" disabled={!file || uploadBusy}>
                    {uploadBusy ? 'Scanning…' : 'Scan file'}
                  </button>
                </div>
              </form>

              <p className="mx-auto mt-8 max-w-3xl text-xs leading-5 text-slate-400">
                By submitting data above, you agree to our Terms of Service and Privacy Notice,
                and to sharing public submissions with the security community. Do not submit
                personal or confidential information.
              </p>
            </div>

            {(error || info) && (
              <div
                className={`mx-auto mt-5 max-w-3xl border px-4 py-3 text-sm ${
                  error
                    ? 'border-red-500/40 bg-red-950/30 text-red-300'
                    : 'border-cyan-500/30 bg-cyan-950/20 text-cyan-200'
                }`}
              >
                {error ?? info}
              </div>
            )}

            <div className="mx-auto mt-10 max-w-3xl border border-[#223657] bg-[#121d34] px-4 py-3 text-xs text-slate-300">
              Want to automate submissions? <span className="text-[#69a7ff]">Check out our API</span>,
              or access your <span className="text-[#69a7ff]">API key</span>.
            </div>
          </div>
        </section>

        {artifact && (
          <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <div className="border-b border-[#263753] pb-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    {artifact.file?.mimeType ?? artifact.type}
                  </h2>
                  <p className="mt-1 break-all font-mono text-xs text-slate-500">
                    {artifact.id}
                  </p>
                </div>
                <div className="text-sm">
                  Verdict: <Verdict value={artifact.latestScan?.overallVerdict} />
                  {reusedScan !== null && (
                    <span className="ml-3 text-xs text-slate-500">
                      {reusedScan ? 'cached result' : 'new scan'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {artifact.file && (
              <div className="mt-5 grid gap-x-6 gap-y-2 border border-[#263753] bg-[#11192b] p-4 text-sm sm:grid-cols-[110px_1fr]">
                <div className="text-slate-500">SHA-256</div>
                <div className="break-all font-mono text-xs">{artifact.file.sha256}</div>
                <div className="text-slate-500">SHA-1</div>
                <div className="break-all font-mono text-xs">{artifact.file.sha1 ?? '—'}</div>
                <div className="text-slate-500">MD5</div>
                <div className="break-all font-mono text-xs">{artifact.file.md5 ?? '—'}</div>
                <div className="text-slate-500">Size</div>
                <div>{artifact.file.size} bytes</div>
              </div>
            )}

            <div className="mt-8">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#263753] pb-3">
                <div>
                  <h3 className="font-semibold">Detection</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {detections.total
                      ? `${detections.malicious} malicious, ${detections.suspicious} suspicious out of ${detections.total} engines`
                      : 'No engine results'}
                  </p>
                </div>
                <div className="text-xs text-slate-500">
                  {formatDate(artifact.latestScan?.completedAt)}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#263753] text-xs text-slate-500">
                      <th className="px-3 py-3 font-medium">Engine</th>
                      <th className="px-3 py-3 font-medium">Result</th>
                      <th className="px-3 py-3 font-medium">Detection</th>
                    </tr>
                  </thead>
                  <tbody>
                    {artifact.latestScan?.engineResults?.length ? (
                      artifact.latestScan.engineResults.map((result) => (
                        <tr key={result.engine} className="border-b border-[#1d2b45]">
                          <td className="px-3 py-3">{result.engine}</td>
                          <td className="px-3 py-3"><Verdict value={result.verdict} /></td>
                          <td className="px-3 py-3 text-slate-400">
                            {result.detectionName ?? '—'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-3 py-4 text-slate-500" colSpan={3}>
                          No engine results.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <section className="mt-8 border-t border-[#263753] pt-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold">AI explanation</h3>
                  <p className="mt-1 max-w-2xl text-sm text-slate-500">
                    Ask GO VIRUS AI to explain the completed scan evidence. Prompts
                    and generated answers are not stored; only usage metrics are logged.
                  </p>
                </div>

                {user && artifact.latestScan?.id && (
                  <button
                    type="button"
                    className="scan-button"
                    disabled={aiBusy}
                    onClick={explainCurrentScan}
                  >
                    {aiBusy ? 'Generating…' : 'Explain this scan'}
                  </button>
                )}
              </div>

              {user ? (
                <form className="mt-4" onSubmit={askAi}>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      className="dark-control flex-1"
                      value={aiPrompt}
                      maxLength={4000}
                      placeholder="Ask a cybersecurity question…"
                      onChange={(event) => setAiPrompt(event.target.value)}
                    />
                    <button
                      className="community-button whitespace-nowrap"
                      disabled={aiBusy || !aiPrompt.trim()}
                    >
                      Ask AI
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mt-4 text-sm text-slate-500">
                  Sign in to use AI explanations.
                </div>
              )}

              {aiError && (
                <div className="mt-4 border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-300">
                  {aiError}
                </div>
              )}

              {(aiAnswer || aiBusy) && (
                <div className="mt-4 border border-[#263753] bg-[#11192b] p-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-400">
                    GO VIRUS AI
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                    {aiAnswer || 'Generating explanation…'}
                  </div>
                </div>
              )}
            </section>

            {isPublic && (
              <section className="mt-10 border-t border-[#263753] pt-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#263753] pb-3">
                  <div>
                    <h3 className="font-semibold">Community</h3>
                    <p className="mt-1 text-sm text-slate-500">Public discussion and verdicts.</p>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
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
                        className="community-button"
                      >
                        {label} {votes?.counts[value] ?? 0}
                      </button>
                    ))}
                  </div>
                </div>

                {user ? (
                  <form className="border-b border-[#263753] py-4" onSubmit={submitComment}>
                    {replyTo && (
                      <div className="mb-2 flex items-center justify-between bg-[#11192b] px-3 py-2 text-xs text-slate-400">
                        <span>Replying to {replyTo.user.username}</span>
                        <button type="button" className="text-[#69a7ff]" onClick={() => setReplyTo(null)}>
                          Cancel
                        </button>
                      </div>
                    )}
                    <textarea
                      className="dark-control min-h-24 resize-y"
                      placeholder="Add a comment…"
                      value={commentBody}
                      maxLength={4000}
                      onChange={(event) => setCommentBody(event.target.value)}
                    />
                    <div className="mt-2 flex justify-end">
                      <button className="scan-button">Comment</button>
                    </div>
                  </form>
                ) : (
                  <div className="border-b border-[#263753] py-4 text-sm text-slate-500">
                    Sign in to comment or vote.
                  </div>
                )}

                <div>
                  {comments.length ? (
                    comments.map((comment) => (
                      <article
                        key={comment.id}
                        className={`border-b border-[#1d2b45] py-4 ${
                          comment.parentId ? 'ml-6 border-l-2 border-l-[#263753] pl-4 sm:ml-10' : ''
                        }`}
                      >
                        <div className="flex justify-between gap-3">
                          <span className="text-sm font-semibold">{comment.user.username}</span>
                          <span className="text-xs text-slate-600">{formatDate(comment.createdAt)}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                          {comment.body}
                        </p>
                        {user && (
                          <button
                            type="button"
                            className="mt-2 text-xs text-[#69a7ff]"
                            onClick={() => setReplyTo(comment)}
                          >
                            Reply
                          </button>
                        )}
                      </article>
                    ))
                  ) : (
                    <p className="py-6 text-sm text-slate-500">No comments yet.</p>
                  )}
                </div>
              </section>
            )}
          </section>
        )}

        {user && notifications.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
            <div className="border-t border-[#263753] pt-5">
              <h3 className="text-sm font-semibold">Notifications</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {notifications.slice(0, 4).map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => markRead(notification)}
                    className={`border border-[#263753] bg-[#11192b] p-3 text-left text-sm ${
                      notification.readAt ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="text-xs text-slate-500">
                      {notification.type.replace(/_/g, ' ')}
                    </div>
                    <div className="mt-1">{notification.message ?? 'New notification'}</div>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
