import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { PageHeader, StatusNotice } from '../components';
import type { HistoryItem } from '../types';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function VerdictBadge({ value }: { value?: string | null }) {
  const verdict = value ?? 'UNKNOWN';
  const className =
    verdict === 'MALICIOUS'
      ? 'border-red-800 bg-red-950/40 text-red-300'
      : verdict === 'SUSPICIOUS'
        ? 'border-amber-800 bg-amber-950/40 text-amber-300'
        : verdict === 'HARMLESS'
          ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300'
          : 'border-slate-700 bg-slate-900 text-slate-400';

  return <span className={'status-badge ' + className}>{verdict}</span>;
}

export default function HistoryPage() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'FILE' | 'URL'>('ALL');
  const [visibilityFilter, setVisibilityFilter] =
    useState<'ALL' | 'PUBLIC' | 'PRIVATE'>('ALL');

  useEffect(() => {
    let active = true;

    if (!token) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    api
      .history(token)
      .then((data) => {
        if (active) setItems(data);
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load submission history',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) =>
          (typeFilter === 'ALL' ||
            item.artifactType === typeFilter) &&
          (visibilityFilter === 'ALL' ||
            item.visibility === visibilityFilter),
      ),
    [items, typeFilter, visibilityFilter],
  );

  if (!user || !token) {
    return (
      <main className="app-page">
        <PageHeader
          title="History"
          description="Your file and URL submissions, scan status, visibility and recent activity."
        />
        <StatusNotice title="Sign in required">
          Submission history belongs to a user account and cannot be shown in anonymous mode.
        </StatusNotice>
      </main>
    );
  }

  return (
    <main className="app-page">
      <PageHeader
        title="History"
        description="Your file and URL submissions, including private activity that only you can see."
      />

      <section className="surface overflow-hidden">
        <div className="surface-header flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Submissions</h2>
            <p className="mt-1 text-xs text-slate-500">
              {visibleItems.length} shown · {items.length} total
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              className="gv-compact-select"
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(
                  event.target.value as
                    | 'ALL'
                    | 'FILE'
                    | 'URL',
                )
              }
            >
              <option value="ALL">All types</option>
              <option value="FILE">Files</option>
              <option value="URL">URLs</option>
            </select>

            <select
              className="gv-compact-select"
              value={visibilityFilter}
              onChange={(event) =>
                setVisibilityFilter(
                  event.target.value as
                    | 'ALL'
                    | 'PUBLIC'
                    | 'PRIVATE',
                )
              }
            >
              <option value="ALL">All visibility</option>
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </select>
          </div>
        </div>

        {error ? (
          <div className="m-5 rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : loading ? (
          <div className="empty-state">
            <p className="text-sm text-slate-500">Loading your history…</p>
          </div>
        ) : visibleItems.length ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Artifact</th>
                  <th>Type</th>
                  <th>Visibility</th>
                  <th>Verdict</th>
                  <th>Status</th>
                  <th>Provider</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={item.id}>
                    <td className="max-w-xl">
                      <Link
                        to={'/artifact/' + item.artifactId}
                        className="block min-w-0 text-slate-200 hover:text-cyan-300"
                      >
                        <span className="block truncate font-medium">
                          {item.displayName}
                        </span>
                        <span className="mt-1 block truncate font-mono text-xs text-slate-600">
                          {item.artifactType === 'FILE'
                            ? item.file?.sha256
                            : item.url?.normalizedUrl}
                        </span>
                      </Link>
                    </td>
                    <td>{item.artifactType}</td>
                    <td>
                      <span
                        className={
                          'status-badge ' +
                          (item.visibility === 'PRIVATE'
                            ? 'border-amber-800 bg-amber-950/40 text-amber-300'
                            : 'border-sky-800 bg-sky-950/40 text-sky-300')
                        }
                      >
                        {item.visibility}
                      </span>
                    </td>
                    <td>
                      <VerdictBadge value={item.latestScan?.verdict} />
                    </td>
                    <td>{item.latestScan?.status ?? '—'}</td>
                    <td>{item.latestScan?.provider ?? '—'}</td>
                    <td className="whitespace-nowrap">
                      {formatDate(item.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p className="text-sm font-semibold text-slate-300">No submissions match these filters</p>
            <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
              Upload a file or analyze a URL, or change the filters above.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
