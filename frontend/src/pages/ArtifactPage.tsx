import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import type { Artifact, Comment, VoteSummary } from '../types';

const verdictText: Record<string, string> = {
  HARMLESS: 'text-emerald-400',
  SUSPICIOUS: 'text-amber-400',
  MALICIOUS: 'text-red-400',
  UNKNOWN: 'text-slate-400',
};

function Verdict({ value }: { value?: string | null }) {
  const verdict = value ?? 'UNKNOWN';
  return (
    <span className={'font-semibold ' + (verdictText[verdict] ?? verdictText.UNKNOWN)}>
      {verdict}
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function ArtifactPage() {
  const { artifactId = '' } = useParams();
  const location = useLocation();
  const { token, user } = useAuth();

  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

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
    setPageError(null);

    api
      .artifact(artifactId, token)
      .then((data) => {
        if (active) setArtifact(data);
      })
      .catch((error) => {
        if (active) {
          setPageError(error instanceof Error ? error.message : 'Artifact not found');
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
  }, [artifactId]);

  useEffect(() => {
    setAiAnswer('');
    setAiError(null);
  }, [artifactId]);

  const detections = useMemo(() => {
    const results = artifact?.latestScan?.engineResults ?? [];
    return {
      malicious: results.filter((result) => result.verdict === 'MALICIOUS').length,
      suspicious: results.filter((result) => result.verdict === 'SUSPICIOUS').length,
      total: results.length,
    };
  }, [artifact]);

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
      setPageError(error instanceof Error ? error.message : 'Comment failed');
    }
  }

  async function vote(value: 'HARMLESS' | 'SUSPICIOUS' | 'MALICIOUS') {
    if (!token) return;

    try {
      await api.vote(artifactId, value, token);
      setVotes(await api.votes(artifactId));
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Vote failed');
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
    return <main className="mx-auto max-w-6xl px-4 py-12 text-sm text-slate-400">Loading artifact…</main>;
  }

  if (!artifact) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="border border-red-500/30 bg-red-950/20 p-5 text-sm text-red-300">
          {pageError ?? 'Artifact not found.'}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#263753] pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Artifact</p>
            <h1 className="mt-1 text-xl font-semibold">
              {artifact.file?.mimeType ?? artifact.url?.domain ?? artifact.type}
            </h1>
            <p className="mt-1 break-all font-mono text-xs text-slate-500">{artifact.id}</p>
          </div>
          <div className="text-right text-sm">
            Verdict: <Verdict value={artifact.latestScan?.overallVerdict} />
            {routeState?.reusedScan !== undefined && (
              <div className="mt-1 text-xs text-slate-500">
                {routeState.reusedScan ? 'fresh result reused' : 'new scan'}
              </div>
            )}
          </div>
        </div>

        {pageError && (
          <div className="mt-4 border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-300">
            {pageError}
          </div>
        )}

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

        {artifact.url && (
          <div className="mt-5 border border-[#263753] bg-[#11192b] p-4 text-sm">
            <div className="text-slate-500">URL</div>
            <div className="mt-1 break-all font-mono text-xs">{artifact.url.normalizedUrl}</div>
          </div>
        )}

        <div className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#263753] pb-3">
            <div>
              <h2 className="font-semibold">Detection</h2>
              <p className="mt-1 text-sm text-slate-400">
                {detections.total
                  ? String(detections.malicious) + ' malicious, ' +
                    String(detections.suspicious) + ' suspicious out of ' +
                    String(detections.total) + ' engines'
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
                    <td className="px-3 py-4 text-slate-500" colSpan={3}>No engine results.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <section className="mt-8 border-t border-[#263753] pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">AI explanation</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Explain the structured scan evidence or ask a cybersecurity question.
                Prompts and generated answers are not stored by GO VIRUS.
              </p>
            </div>
            {user && artifact.latestScan?.id && (
              <button className="scan-button" disabled={aiBusy} onClick={explainScan}>
                {aiBusy ? 'Generating…' : 'Explain this scan'}
              </button>
            )}
          </div>

          {user ? (
            <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={askAi}>
              <input
                className="dark-control flex-1"
                value={aiPrompt}
                maxLength={4000}
                placeholder="Ask a cybersecurity question…"
                onChange={(event) => setAiPrompt(event.target.value)}
              />
              <button className="community-button whitespace-nowrap" disabled={aiBusy || !aiPrompt.trim()}>
                Ask AI
              </button>
            </form>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Sign in to use AI explanations.</p>
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

        <section className="mt-10 border-t border-[#263753] pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#263753] pb-3">
            <div>
              <h2 className="font-semibold">Community</h2>
              <p className="mt-1 text-sm text-slate-500">
                {communityAvailable
                  ? 'Public discussion and community verdicts.'
                  : 'Community is unavailable for this artifact or submission.'}
              </p>
            </div>

            {communityAvailable && (
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
                    onClick={() => void vote(value)}
                    className="community-button"
                  >
                    {label} {votes?.counts[value] ?? 0}
                  </button>
                ))}
              </div>
            )}
          </div>

          {communityAvailable && user && (
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
          )}

          {communityAvailable && !user && (
            <div className="border-b border-[#263753] py-4 text-sm text-slate-500">
              Sign in to comment or vote.
            </div>
          )}

          {communityAvailable && (
            <div>
              {comments.length ? (
                comments.map((comment) => (
                  <article
                    key={comment.id}
                    className={
                      'border-b border-[#1d2b45] py-4 ' +
                      (comment.parentId ? 'ml-6 border-l-2 border-l-[#263753] pl-4 sm:ml-10' : '')
                    }
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
          )}
        </section>
      </section>
    </main>
  );
}
