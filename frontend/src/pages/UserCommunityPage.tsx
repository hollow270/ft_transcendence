import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { PageHeader, StatusNotice } from '../components';
import type {
  UserCommunity,
  UserCommunityComment,
  UserCommunitySubmission,
} from '../types';

type ActivityTab = 'scans' | 'comments';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function visibilityClass(visibility: 'PUBLIC' | 'PRIVATE') {
  return visibility === 'PUBLIC'
    ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300'
    : 'border-amber-800 bg-amber-950/40 text-amber-300';
}

function verdictClass(verdict?: string | null) {
  if (verdict === 'MALICIOUS') {
    return 'border-red-800 bg-red-950/40 text-red-300';
  }
  if (verdict === 'SUSPICIOUS') {
    return 'border-amber-800 bg-amber-950/40 text-amber-300';
  }
  if (verdict === 'HARMLESS') {
    return 'border-emerald-800 bg-emerald-950/40 text-emerald-300';
  }
  return 'border-slate-700 bg-slate-900 text-slate-400';
}

function SubmissionRow({
  item,
}: {
  item: UserCommunitySubmission;
}) {
  return (
    <tr>
      <td>
        <Link
          className="font-medium text-slate-200 hover:text-blue-300 hover:underline"
          to={'/artifact/' + item.artifactId}
        >
          {item.displayName}
        </Link>
        <div className="mt-1 font-mono text-[11px] text-slate-600">
          {item.artifactId}
        </div>
      </td>
      <td>{item.artifactType}</td>
      <td>
        <span className={'status-badge ' + visibilityClass(item.visibility)}>
          {item.visibility}
        </span>
      </td>
      <td>
        <span className={'status-badge ' + verdictClass(item.latestScan?.verdict)}>
          {item.latestScan?.verdict ?? 'NO SCAN'}
        </span>
      </td>
      <td className="whitespace-nowrap text-slate-500">
        {formatDate(item.createdAt)}
      </td>
    </tr>
  );
}

function CommentCard({
  item,
}: {
  item: UserCommunityComment;
}) {
  return (
    <article className="border-b border-slate-800 px-5 py-4 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to={'/artifact/' + item.artifactId}
            className="text-sm font-medium text-slate-200 hover:text-blue-300 hover:underline"
          >
            {item.artifactDisplayName}
          </Link>
          <p className="mt-1 text-xs text-slate-600">
            Commented on this {item.artifactType.toLowerCase()} artifact
          </p>
        </div>
        <time className="text-xs text-slate-600">
          {formatDate(item.createdAt)}
        </time>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">
        {item.body}
      </p>

      {item.editedAt && (
        <p className="mt-2 text-xs text-slate-600">
          Edited {formatDate(item.editedAt)}
        </p>
      )}
    </article>
  );
}

export default function UserCommunityPage() {
  const { userId = '' } = useParams();
  const { token, user: currentUser } = useAuth();
  const [data, setData] = useState<UserCommunity | null>(null);
  const [tab, setTab] = useState<ActivityTab>('scans');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    api
      .userCommunity(userId, token)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((caught) => {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Could not load community activity',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId, token]);

  const publicScans = useMemo(
    () =>
      data?.submissions.filter(
        (submission) => submission.visibility === 'PUBLIC',
      ).length ?? 0,
    [data],
  );

  const privateScans = useMemo(
    () =>
      data?.submissions.filter(
        (submission) => submission.visibility === 'PRIVATE',
      ).length ?? 0,
    [data],
  );

  if (loading) {
    return (
      <main className="app-page">
        <div className="surface p-8 text-sm text-slate-500">
          Loading community activity…
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="app-page">
        <PageHeader title="Community activity" />
        <div className="rounded-lg border border-red-900 bg-red-950/30 p-5 text-sm text-red-300">
          {error ?? 'User not found.'}
        </div>
      </main>
    );
  }

  return (
    <main className="app-page">
      <PageHeader
        title={data.user.username}
        description={
          data.isOwner
            ? 'Your scan and comment activity. Private scans are visible only to you.'
            : 'Public scan and comment activity shared by this user.'
        }
        actions={
          <span className="status-badge border-slate-700 bg-slate-900 text-slate-400">
            {data.user.role}
          </span>
        }
      />

      <section className="surface overflow-hidden">
        <div className="grid sm:grid-cols-3">
          <div className="border-b border-slate-800 p-5 sm:border-b-0 sm:border-r">
            <p className="text-xs uppercase tracking-wide text-slate-600">
              Public scans
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-200">
              {publicScans}
            </p>
          </div>

          <div className="border-b border-slate-800 p-5 sm:border-b-0 sm:border-r">
            <p className="text-xs uppercase tracking-wide text-slate-600">
              Comments
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-200">
              {data.comments.length}
            </p>
          </div>

          <div className="p-5">
            <p className="text-xs uppercase tracking-wide text-slate-600">
              {data.isOwner ? 'Private scans' : 'Member since'}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-200">
              {data.isOwner
                ? privateScans
                : new Date(data.user.createdAt).getFullYear()}
            </p>
          </div>
        </div>
      </section>

      {data.isOwner && privateScans > 0 && (
        <div className="mt-5">
          <StatusNotice title="Private activity is visible only to you">
            Other users receive only your PUBLIC submissions and comments made on
            public artifacts. Your PRIVATE scans stay hidden from public community
            pages.
          </StatusNotice>
        </div>
      )}

      <div className="mt-6 border-b border-slate-800">
        <nav className="-mb-px flex gap-6">
          <button
            className={
              'border-b-2 px-1 pb-3 text-sm font-medium ' +
              (tab === 'scans'
                ? 'border-blue-500 text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300')
            }
            onClick={() => setTab('scans')}
          >
            Scans
          </button>
          <button
            className={
              'border-b-2 px-1 pb-3 text-sm font-medium ' +
              (tab === 'comments'
                ? 'border-blue-500 text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300')
            }
            onClick={() => setTab('comments')}
          >
            Comments
          </button>
        </nav>
      </div>

      {tab === 'scans' && (
        <section className="mt-6 surface overflow-hidden">
          <div className="surface-header">
            <h2 className="text-sm font-semibold text-slate-200">
              Scan activity
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {data.isOwner
                ? 'Your public and private submissions.'
                : 'Only public submissions are shown.'}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Artifact</th>
                  <th>Type</th>
                  <th>Visibility</th>
                  <th>Verdict</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {data.submissions.length ? (
                  data.submissions.map((item) => (
                    <SubmissionRow key={item.id} item={item} />
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty-state">
                        <p className="text-sm font-semibold text-slate-300">
                          No visible scan activity
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Public submissions will appear here.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'comments' && (
        <section className="mt-6 surface overflow-hidden">
          <div className="surface-header">
            <h2 className="text-sm font-semibold text-slate-200">
              Community comments
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Comments are shown with the file or URL where they were posted.
            </p>
          </div>

          {data.comments.length ? (
            <div>
              {data.comments.map((item) => (
                <CommentCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p className="text-sm font-semibold text-slate-300">
                No comments yet
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Public comments will appear here.
              </p>
            </div>
          )}
        </section>
      )}

      {currentUser && currentUser.id !== data.user.id && (
        <p className="mt-5 text-xs text-slate-600">
          Privacy rule: private submissions are never included in another user's
          community view.
        </p>
      )}
    </main>
  );
}
