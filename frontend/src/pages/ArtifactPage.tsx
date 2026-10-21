import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { PageHeader, StatusNotice } from '../components';
import type {
  Artifact,
  ArtifactScanHistoryItem,
  Comment,
  VoteSummary,
} from '../types';

type Tab = 'detection' | 'details' | 'history' | 'community' | 'ai';

const verdictClass: Record<string, string> = {
  HARMLESS: 'border-emerald-800 bg-emerald-950/40 text-emerald-300',
  SUSPICIOUS: 'border-amber-800 bg-amber-950/40 text-amber-300',
  MALICIOUS: 'border-red-800 bg-red-950/40 text-red-300',
  UNKNOWN: 'border-slate-700 bg-slate-900 text-slate-400',
};

function VerdictBadge({ value }: { value?: string | null }) {
  const verdict = value ?? 'UNKNOWN';
  return (
    <span className={'status-badge ' + (verdictClass[verdict] ?? verdictClass.UNKNOWN)}>
      {verdict}
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-2 border-b border-slate-800 py-3 last:border-b-0 sm:grid-cols-[150px_1fr]">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className={'min-w-0 break-all text-sm text-slate-300 ' + (mono ? 'font-mono text-xs' : '')}>
        {value}
      </dd>
    </div>
  );
}

export default function ArtifactPage() {
  const { artifactId = '' } = useParams();
  const location = useLocation();
  const { token, user } = useAuth();

  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanHistory, setScanHistory] = useState<ArtifactScanHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistoryScanId, setSelectedHistoryScanId] =
    useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('detection');

  const [comments, setComments] = useState<Comment[]>([]);
  const [votes, setVotes] = useState<VoteSummary | null>(null);
  const [communityAvailable, setCommunityAvailable] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const routeState = location.state as
    | { reusedScan?: boolean; submissionVisibility?: 'PUBLIC' | 'PRIVATE' }
    | null;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);

    api
      .artifact(artifactId, token)
      .then((data) => {
        if (active) setArtifact(data);
      })
      .catch((error) => {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'Artifact not found');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [artifactId, token]);

  useEffect(() => {
    if (!artifactId) return;
    void refreshCommunity();
    void loadScanHistory();
  }, [artifactId, token]);

  useEffect(() => {
    setAiAnswer('');
    setAiError(null);
  }, [artifactId]);

  useEffect(() => {
    if (artifact?.latestScan?.status !== 'RUNNING') return;

    const timer = window.setInterval(() => {
      void refreshPendingScan(true);
    }, 60000);

    return () => window.clearInterval(timer);
  }, [artifact?.latestScan?.id, artifact?.latestScan?.status, token]);


  const detections = useMemo(() => {
    const results = artifact?.latestScan?.engineResults ?? [];
    return {
      malicious: results.filter((result) => result.verdict === 'MALICIOUS').length,
      suspicious: results.filter((result) => result.verdict === 'SUSPICIOUS').length,
      harmless: results.filter((result) => result.verdict === 'HARMLESS').length,
      total: results.length,
    };
  }, [artifact]);

  async function loadScanHistory() {
    setHistoryLoading(true);

    try {
      const history = await api.artifactScanHistory(artifactId, token);
      setScanHistory(history);

      setSelectedHistoryScanId((current) => {
        if (current && history.some((scan) => scan.id === current)) {
          return current;
        }
        return history[0]?.id ?? null;
      });
    } catch (error) {
      setScanHistory([]);
      setSelectedHistoryScanId(null);
      setActionError(
        error instanceof Error
          ? error.message
          : 'Could not load scan history',
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  async function refreshCommunity() {
    try {
      const [commentData, voteData] = await Promise.all([
        api.comments(artifactId),
        api.votes(artifactId),
      ]);
      setComments(commentData);
      setVotes(voteData);
      setCommunityAvailable(true);
    } catch {
      setComments([]);
      setVotes(null);
      setCommunityAvailable(false);
    }
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    if (!token || !commentBody.trim()) return;

    setActionError(null);

    try {
      await api.createComment(
        artifactId,
        {
          body: commentBody.trim(),
          ...(replyTo ? { parentId: replyTo.id } : {}),
        },
        token,
      );
      setCommentBody('');
      setReplyTo(null);
      await refreshCommunity();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Comment failed');
    }
  }

  async function vote(value: 'HARMLESS' | 'SUSPICIOUS' | 'MALICIOUS') {
    if (!token) return;

    setActionError(null);

    try {
      await api.vote(artifactId, value, token);
      setVotes(await api.votes(artifactId));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Vote failed');
    }
  }

  async function refreshPendingScan(silent = false) {
    if (!artifactId) return;

    if (!silent) {
      setScanBusy(true);
      setActionError(null);
    }

    try {
      await api.refreshArtifactScan(artifactId, token);
      const updated = await api.artifact(artifactId, token);
      setArtifact(updated);
      await loadScanHistory();
    } catch (error) {
      if (!silent) {
        setActionError(
          error instanceof Error ? error.message : 'Could not refresh scan status',
        );
      }
    } finally {
      if (!silent) setScanBusy(false);
    }
  }

  async function requestRescan() {
    if (!token || !artifact?.file) return;

    setScanBusy(true);
    setActionError(null);

    try {
      await api.rescanArtifact(artifactId, token);
      const updated = await api.artifact(artifactId, token);
      setArtifact(updated);
      await loadScanHistory();
      setTab('history');
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Could not start rescan',
      );
    } finally {
      setScanBusy(false);
    }
  }

  async function explainScan() {
    const scanId = artifact?.latestScan?.id;
    if (!token || !scanId) return;

    setAiBusy(true);
    setAiAnswer('');
    setAiError(null);

    try {
      await api.explainScan(scanId, token, (text) => {
        setAiAnswer((current) => current + text);
      });
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI explanation failed');
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
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI request failed');
    } finally {
      setAiBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="app-page">
        <div className="surface p-8 text-sm text-slate-500">Loading artifact report…</div>
      </main>
    );
  }

  if (!artifact) {
    return (
      <main className="app-page">
        <PageHeader title="Artifact report" />
        <div className="rounded-lg border border-red-900 bg-red-950/30 p-5 text-sm text-red-300">
          {loadError ?? 'Artifact not found.'}
        </div>
      </main>
    );
  }

  const displayName =
    artifact.submission?.originalFilename ||
    artifact.submission?.originalUrl ||
    artifact.url?.domain ||
    (artifact.file ? artifact.file.sha256.slice(0, 16) + '…' : null) ||
    artifact.id;

  const selectedHistoryScan =
    scanHistory.find((scan) => scan.id === selectedHistoryScanId) ??
    scanHistory[0] ??
    null;

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'detection', label: 'Detection' },
    { id: 'details', label: 'Details' },
    { id: 'history', label: 'History' },
    { id: 'community', label: 'Community' },
    { id: 'ai', label: 'AI explanation' },
  ];

  return (
    <main className="app-page">
      <PageHeader
        title={artifact.file ? 'File report' : 'URL report'}
        description={displayName}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <VerdictBadge value={artifact.latestScan?.overallVerdict} />
            {artifact.latestScan?.status === 'RUNNING' && (
              <button
                className="secondary-button"
                disabled={scanBusy}
                onClick={() => void refreshPendingScan(false)}
              >
                {scanBusy ? 'Refreshing…' : 'Refresh results'}
              </button>
            )}
            {user && artifact.file && artifact.latestScan?.status !== 'RUNNING' && (
              <button
                className="secondary-button"
                disabled={scanBusy}
                onClick={() => void requestRescan()}
              >
                {scanBusy ? 'Starting…' : 'Rescan'}
              </button>
            )}
          </div>
        }
      />

      <section className="surface overflow-hidden">
        <div className="grid gap-0 sm:grid-cols-4">
          <div className="border-b border-slate-800 p-5 sm:border-b-0 sm:border-r">
            <p className="text-xs uppercase tracking-wide text-slate-600">Type</p>
            <p className="mt-1 text-sm font-medium text-slate-200">{artifact.type}</p>
          </div>
          <div className="border-b border-slate-800 p-5 sm:border-b-0 sm:border-r">
            <p className="text-xs uppercase tracking-wide text-slate-600">Detections</p>
            <p className="mt-1 text-sm font-medium text-slate-200">
              {detections.malicious + detections.suspicious} / {detections.total || 0}
            </p>
          </div>
          <div className="border-b border-slate-800 p-5 sm:border-b-0 sm:border-r">
            <p className="text-xs uppercase tracking-wide text-slate-600">Last scan</p>
            <p className="mt-1 text-sm font-medium text-slate-200">
              {formatDate(artifact.latestScan?.completedAt)}
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs uppercase tracking-wide text-slate-600">Result source</p>
            <p className="mt-1 text-sm font-medium text-slate-200">
              {routeState?.reusedScan === true
                ? 'Fresh cached result'
                : routeState?.reusedScan === false
                  ? 'New scan'
                  : 'Stored report'}
            </p>
          </div>
        </div>
      </section>

      {actionError && (
        <div className="mt-5 rounded-md border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {actionError}
        </div>
      )}

      <div className="mt-6 border-b border-slate-800">
        <nav className="-mb-px flex gap-6 overflow-x-auto">
          {tabs.map((item) => (
            <button
              key={item.id}
              className={
                'whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition ' +
                (tab === item.id
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300')
              }
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'detection' && (
        <section className="mt-6 surface overflow-hidden">
          {artifact.latestScan?.status === 'RUNNING' && (
            <div className="border-b border-slate-800 p-5">
              <StatusNotice title="Analysis is still running">
                The external provider has accepted this file. GO VIRUS will refresh the report automatically, or you can use “Refresh results”.
              </StatusNotice>
            </div>
          )}

          {artifact.latestScan?.status === 'FAILED' && (
            <div className="border-b border-red-900 bg-red-950/20 p-5 text-sm text-red-300">
              Scan failed{artifact.latestScan.errorMessage ? ': ' + artifact.latestScan.errorMessage : '.'}
            </div>
          )}
          <div className="surface-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Engine results</h2>
              <p className="mt-1 text-xs text-slate-500">
                {detections.malicious} malicious · {detections.suspicious} suspicious · {detections.harmless} harmless
              </p>
            </div>
            <span className="text-xs text-slate-600">
              Scan reason: {artifact.latestScan?.reason ?? '—'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Engine</th>
                  <th>Verdict</th>
                  <th>Detection name</th>
                  <th>Response time</th>
                </tr>
              </thead>
              <tbody>
                {artifact.latestScan?.engineResults?.length ? (
                  artifact.latestScan.engineResults.map((result) => (
                    <tr key={result.engine}>
                      <td className="font-medium text-slate-200">{result.engine}</td>
                      <td><VerdictBadge value={result.verdict} /></td>
                      <td>{result.detectionName ?? '—'}</td>
                      <td>{result.responseTimeMs ? result.responseTimeMs + ' ms' : '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>
                      <div className="empty-state">
                        <p className="text-sm font-semibold text-slate-300">No engine results</p>
                        <p className="mt-1 text-sm text-slate-500">This scan has no stored engine responses.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'details' && (
        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="surface">
            <div className="surface-header">
              <h2 className="text-sm font-semibold text-slate-200">Artifact details</h2>
            </div>
            <dl className="px-5">
              <DetailRow label="Artifact ID" value={artifact.id} mono />
              <DetailRow label="First seen" value={formatDate(artifact.firstSeenAt)} />
              <DetailRow label="Last seen" value={formatDate(artifact.lastSeenAt)} />
              <DetailRow label="Submitted" value={formatDate(artifact.submission?.createdAt)} />
              <DetailRow
                label="Submission visibility"
                value={artifact.submission?.visibility ?? artifact.latestScan?.visibility ?? '—'}
              />
              {artifact.submission?.originalFilename && (
                <DetailRow label="Original filename" value={artifact.submission.originalFilename} />
              )}
              {artifact.file && (
                <>
                  <DetailRow label="SHA-256" value={artifact.file.sha256} mono />
                  <DetailRow label="SHA-1" value={artifact.file.sha1 ?? '—'} mono />
                  <DetailRow label="MD5" value={artifact.file.md5 ?? '—'} mono />
                  <DetailRow label="MIME type" value={artifact.file.mimeType} />
                  <DetailRow label="Size" value={artifact.file.size + ' bytes'} />
                </>
              )}
              {artifact.url && (
                <>
                  <DetailRow label="Normalized URL" value={artifact.url.normalizedUrl} mono />
                  <DetailRow label="Domain" value={artifact.url.domain ?? '—'} />
                </>
              )}
            </dl>
          </div>

          <aside className="space-y-5">
            <section className="surface">
              <div className="surface-body">
                <h2 className="text-sm font-semibold text-slate-200">Scan status</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Status</dt>
                    <dd className="text-slate-300">{artifact.latestScan?.status ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Visibility</dt>
                    <dd className="text-slate-300">
                      {artifact.submission?.visibility ?? routeState?.submissionVisibility ?? artifact.latestScan?.visibility ?? '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Provider</dt>
                    <dd className="text-right text-slate-300">{artifact.latestScan?.provider ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Provider status</dt>
                    <dd className="text-right text-slate-300">{artifact.latestScan?.providerStatus ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Fresh until</dt>
                    <dd className="text-right text-slate-300">{formatDate(artifact.latestScan?.staleAt)}</dd>
                  </div>
                </dl>
              </div>
            </section>
          </aside>
        </section>
      )}

      {tab === 'history' && (
        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="surface overflow-hidden">
            <div className="surface-header flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-200">Scan history</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Previous analyses that you are allowed to view for this artifact.
                </p>
              </div>
              <span className="text-xs text-slate-600">
                {scanHistory.length} scan{scanHistory.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reason</th>
                    <th>Provider</th>
                    <th>Status</th>
                    <th>Visibility</th>
                    <th>Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty-state">
                          <p className="text-sm text-slate-500">Loading scan history…</p>
                        </div>
                      </td>
                    </tr>
                  ) : scanHistory.length ? (
                    scanHistory.map((scan) => (
                      <tr
                        key={scan.id}
                        className={
                          'cursor-pointer transition hover:bg-slate-800/40 ' +
                          (selectedHistoryScan?.id === scan.id ? 'bg-slate-800/50' : '')
                        }
                        onClick={() => setSelectedHistoryScanId(scan.id)}
                      >
                        <td className="whitespace-nowrap">
                          {formatDate(scan.completedAt ?? scan.createdAt)}
                        </td>
                        <td>{scan.reason}</td>
                        <td>{scan.provider ?? '—'}</td>
                        <td>{scan.status}</td>
                        <td>
                          <span
                            className={
                              'status-badge ' +
                              (scan.visibility === 'PRIVATE'
                                ? 'border-amber-800 bg-amber-950/40 text-amber-300'
                                : 'border-sky-800 bg-sky-950/40 text-sky-300')
                            }
                          >
                            {scan.visibility}
                          </span>
                        </td>
                        <td>
                          <VerdictBadge value={scan.overallVerdict} />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty-state">
                          <p className="text-sm font-semibold text-slate-300">
                            No scan history
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Previous scans will appear here after analysis or rescan.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="surface h-fit overflow-hidden">
            <div className="surface-header">
              <h2 className="text-sm font-semibold text-slate-200">
                Selected scan
              </h2>
            </div>

            {selectedHistoryScan ? (
              <>
                <dl className="px-5">
                  <DetailRow
                    label="Scan ID"
                    value={selectedHistoryScan.id}
                    mono
                  />
                  <DetailRow
                    label="Created"
                    value={formatDate(selectedHistoryScan.createdAt)}
                  />
                  <DetailRow
                    label="Completed"
                    value={formatDate(selectedHistoryScan.completedAt)}
                  />
                  <DetailRow
                    label="Reason"
                    value={selectedHistoryScan.reason}
                  />
                  <DetailRow
                    label="Provider"
                    value={selectedHistoryScan.provider ?? '—'}
                  />
                  <DetailRow
                    label="Visibility"
                    value={selectedHistoryScan.visibility}
                  />
                </dl>

                <div className="border-t border-slate-800">
                  <div className="px-5 py-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Engine results
                    </h3>
                  </div>

                  {selectedHistoryScan.engineResults.length ? (
                    <div className="max-h-80 overflow-y-auto">
                      {selectedHistoryScan.engineResults.map((result) => (
                        <div
                          key={result.engine}
                          className="border-t border-slate-800 px-5 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-slate-300">
                              {result.engine}
                            </span>
                            <VerdictBadge value={result.verdict} />
                          </div>
                          {result.detectionName && (
                            <p className="mt-1 break-words text-xs text-slate-500">
                              {result.detectionName}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-5 pb-5 text-sm text-slate-500">
                      No engine results stored for this scan.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-state min-h-40">
                <p className="text-sm text-slate-500">
                  Select a scan to inspect its engine results.
                </p>
              </div>
            )}
          </aside>
        </section>
      )}

      {tab === 'community' && (
        <section className="mt-6">
          {!communityAvailable ? (
            <StatusNotice title="Community is not available for this artifact">
              Private submissions are excluded from public community discussion, or the community endpoint is unavailable.
            </StatusNotice>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
              <section className="surface">
                <div className="surface-header">
                  <h2 className="text-sm font-semibold text-slate-200">Discussion</h2>
                </div>

                {user ? (
                  <form className="border-b border-slate-800 p-5" onSubmit={submitComment}>
                    {replyTo && (
                      <div className="mb-3 flex items-center justify-between rounded-md bg-slate-950 px-3 py-2 text-xs text-slate-500">
                        <span>Replying to {replyTo.user.username}</span>
                        <button type="button" className="text-link" onClick={() => setReplyTo(null)}>
                          Cancel
                        </button>
                      </div>
                    )}
                    <textarea
                      className="app-input min-h-24 resize-y"
                      placeholder="Add useful context about this artifact…"
                      value={commentBody}
                      maxLength={4000}
                      onChange={(event) => setCommentBody(event.target.value)}
                    />
                    <div className="mt-3 flex justify-end">
                      <button className="primary-button">Post comment</button>
                    </div>
                  </form>
                ) : (
                  <div className="border-b border-slate-800 px-5 py-4 text-sm text-slate-500">
                    Sign in to comment.
                  </div>
                )}

                <div>
                  {comments.length ? (
                    comments.map((comment) => (
                      <article
                        key={comment.id}
                        className={
                          'border-b border-slate-800 px-5 py-4 last:border-b-0 ' +
                          (comment.parentId ? 'ml-6 border-l border-l-slate-700 sm:ml-10' : '')
                        }
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Link
                            to={'/users/' + comment.user.id + '/community'}
                            className="text-sm font-medium text-slate-200 hover:text-blue-300 hover:underline"
                          >
                            {comment.user.username}
                          </Link>
                          <span className="text-xs text-slate-600">{formatDate(comment.createdAt)}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">{comment.body}</p>
                        {user && (
                          <button type="button" className="text-link mt-2 text-xs" onClick={() => setReplyTo(comment)}>
                            Reply
                          </button>
                        )}
                      </article>
                    ))
                  ) : (
                    <div className="empty-state">
                      <p className="text-sm font-semibold text-slate-300">No comments yet</p>
                      <p className="mt-1 text-sm text-slate-500">Be the first to add context to this artifact.</p>
                    </div>
                  )}
                </div>
              </section>

              <aside className="surface h-fit">
                <div className="surface-header">
                  <h2 className="text-sm font-semibold text-slate-200">Community verdict</h2>
                </div>
                <div className="surface-body space-y-3">
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
                      onClick={() => void vote(value)}
                      className="flex w-full items-center justify-between rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-300 hover:border-slate-700 disabled:opacity-50"
                    >
                      <span>{label}</span>
                      <span className="font-medium">{votes?.counts[value] ?? 0}</span>
                    </button>
                  ))}
                </div>
              </aside>
            </div>
          )}
        </section>
      )}

      {tab === 'ai' && (
        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          {!user ? (
            <div className="xl:col-span-2">
              <StatusNotice title="Sign in required">
                AI scan explanations are available to registered users.
              </StatusNotice>
            </div>
          ) : (
            <>
              <section className="surface">
                <div className="surface-header flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-200">Scan explanation</h2>
                    <p className="mt-1 text-xs text-slate-500">Generated from the structured scan evidence stored for this report.</p>
                  </div>
                  <button
                    className="primary-button"
                    disabled={
                      aiBusy ||
                      !artifact.latestScan?.id ||
                      artifact.latestScan.status !== 'COMPLETED'
                    }
                    onClick={explainScan}
                  >
                    {aiBusy ? 'Generating…' : 'Explain scan'}
                  </button>
                </div>

                <div className="surface-body">
                  <form className="flex flex-col gap-2 sm:flex-row" onSubmit={askAi}>
                    <input
                      className="app-input flex-1"
                      value={aiPrompt}
                      maxLength={4000}
                      placeholder="Ask a follow-up cybersecurity question…"
                      onChange={(event) => setAiPrompt(event.target.value)}
                    />
                    <button className="secondary-button" disabled={aiBusy || !aiPrompt.trim()}>
                      Ask
                    </button>
                  </form>

                  {aiError && (
                    <div className="mt-4 rounded-md border border-red-900 bg-red-950/30 p-4 text-sm text-red-300">
                      {aiError}
                    </div>
                  )}

                  {(aiAnswer || aiBusy) ? (
                    <div className="mt-5 border-t border-slate-800 pt-5">
                      <div className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
                        {aiAnswer || 'Generating explanation…'}
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state min-h-36">
                      <p className="text-sm font-semibold text-slate-300">No explanation generated yet</p>
                      <p className="mt-1 text-sm text-slate-500">Use “Explain scan” to summarize the evidence in this report.</p>
                    </div>
                  )}
                </div>
              </section>

              <aside className="surface h-fit">
                <div className="surface-body">
                  <h2 className="text-sm font-semibold text-slate-200">Privacy</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    GO VIRUS logs LLM usage metrics, but does not persist the prompt or generated answer.
                  </p>
                </div>
              </aside>
            </>
          )}
        </section>
      )}
    </main>
  );
}
