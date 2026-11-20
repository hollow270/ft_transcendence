import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { PageHeader } from '../components';
import type {
  AdvancedSearchResponse,
  AdvancedSearchSort,
} from '../types';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function VerdictBadge({
  value,
}: {
  value?: string | null;
}) {
  const verdict = value ?? 'UNKNOWN';
  const className =
    verdict === 'MALICIOUS'
      ? 'border-red-800 bg-red-950/40 text-red-300'
      : verdict === 'SUSPICIOUS'
        ? 'border-amber-800 bg-amber-950/40 text-amber-300'
        : verdict === 'HARMLESS'
          ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300'
          : 'border-slate-700 bg-slate-900 text-slate-400';

  return (
    <span className={'status-badge ' + className}>
      {verdict}
    </span>
  );
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = (params.get('q') ?? '').trim();
  const type =
    params.get('type') === 'FILE' ||
    params.get('type') === 'URL'
      ? (params.get('type') as 'FILE' | 'URL')
      : '';
  const verdictValues = [
    'UNKNOWN',
    'HARMLESS',
    'SUSPICIOUS',
    'MALICIOUS',
  ] as const;
  const rawVerdict = params.get('verdict');
  const verdict = verdictValues.includes(
    rawVerdict as (typeof verdictValues)[number],
  )
    ? (rawVerdict as (typeof verdictValues)[number])
    : '';
  const sortValues: AdvancedSearchSort[] = [
    'LAST_SEEN_DESC',
    'LAST_SEEN_ASC',
    'FIRST_SEEN_DESC',
    'FIRST_SEEN_ASC',
  ];
  const rawSort = params.get('sort');
  const sort = sortValues.includes(
    rawSort as AdvancedSearchSort,
  )
    ? (rawSort as AdvancedSearchSort)
    : 'LAST_SEEN_DESC';
  const page = Math.max(
    1,
    Number(params.get('page') ?? 1) || 1,
  );
  const pageSize = Math.max(
    5,
    Math.min(
      50,
      Number(params.get('pageSize') ?? 10) ||
        10,
    ),
  );

  const [result, setResult] =
    useState<AdvancedSearchResponse | null>(null);
  const [loading, setLoading] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    api
      .searchArtifactsAdvanced({
        query,
        type,
        verdict,
        sort,
        page,
        pageSize,
      })
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((err) => {
        if (active) {
          setResult(null);
          setError(
            err instanceof Error
              ? err.message
              : 'Search failed',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    query,
    type,
    verdict,
    sort,
    page,
    pageSize,
  ]);

  function updateParam(
    key: string,
    value: string,
    resetPage = true,
  ) {
    const next = new URLSearchParams(params);

    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }

    if (resetPage) {
      next.delete('page');
    }

    setParams(next);
  }

  const items = result?.items ?? [];

  return (
    <main className="app-page">
      <PageHeader
        title="Search"
        description="Search public GO VIRUS artifacts with filters, sorting and pagination."
      />

      <section className="surface mb-5">
        <div className="surface-header">
          <h2 className="text-sm font-semibold text-slate-200">
            Search controls
          </h2>
        </div>

        <div className="surface-body grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="block xl:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">
              Query
            </span>
            <input
              className="app-input"
              value={query}
              placeholder="Filename, hash, domain, URL or artifact ID"
              onChange={(event) =>
                updateParam(
                  'q',
                  event.target.value,
                )
              }
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">
              Type
            </span>
            <select
              className="app-input"
              value={type}
              onChange={(event) =>
                updateParam(
                  'type',
                  event.target.value,
                )
              }
            >
              <option value="">All types</option>
              <option value="FILE">Files</option>
              <option value="URL">URLs</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">
              Verdict
            </span>
            <select
              className="app-input"
              value={verdict}
              onChange={(event) =>
                updateParam(
                  'verdict',
                  event.target.value,
                )
              }
            >
              <option value="">All verdicts</option>
              <option value="HARMLESS">
                Harmless
              </option>
              <option value="SUSPICIOUS">
                Suspicious
              </option>
              <option value="MALICIOUS">
                Malicious
              </option>
              <option value="UNKNOWN">
                Unknown
              </option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-400">
              Sort
            </span>
            <select
              className="app-input"
              value={sort}
              onChange={(event) =>
                updateParam(
                  'sort',
                  event.target.value,
                )
              }
            >
              <option value="LAST_SEEN_DESC">
                Last seen · newest
              </option>
              <option value="LAST_SEEN_ASC">
                Last seen · oldest
              </option>
              <option value="FIRST_SEEN_DESC">
                First seen · newest
              </option>
              <option value="FIRST_SEEN_ASC">
                First seen · oldest
              </option>
            </select>
          </label>
        </div>
      </section>

      <section className="surface overflow-hidden">
        <div className="surface-header flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">
              Search results
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Public artifacts only
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-600">
            <label className="flex items-center gap-2">
              <span>Rows</span>
              <select
                className="gv-compact-select"
                value={pageSize}
                onChange={(event) =>
                  updateParam(
                    'pageSize',
                    event.target.value,
                  )
                }
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </label>
            <span>
              {loading
                ? 'Searching…'
                : (result?.total ?? 0) +
                  ' result' +
                  ((result?.total ?? 0) === 1
                    ? ''
                    : 's')}
            </span>
          </div>
        </div>

        {error ? (
          <div className="m-5 rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : loading && !result ? (
          <div className="empty-state">
            <p className="text-sm text-slate-500">
              Searching public artifacts…
            </p>
          </div>
        ) : items.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Artifact</th>
                    <th>Type</th>
                    <th>Verdict</th>
                    <th>Status</th>
                    <th>Provider</th>
                    <th>First seen</th>
                    <th>Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="max-w-xl">
                        <Link
                          to={
                            '/artifact/' + item.id
                          }
                          className="block min-w-0 text-slate-200 hover:text-cyan-300"
                        >
                          <span className="block truncate font-medium">
                            {item.displayName}
                          </span>
                          <span className="mt-1 block truncate font-mono text-xs text-slate-600">
                            {item.type === 'FILE'
                              ? item.file?.sha256
                              : item.url
                                  ?.normalizedUrl}
                          </span>
                        </Link>
                      </td>
                      <td>{item.type}</td>
                      <td>
                        <VerdictBadge
                          value={
                            item.latestScan
                              ?.verdict
                          }
                        />
                      </td>
                      <td>
                        {item.latestScan?.status ??
                          '—'}
                      </td>
                      <td>
                        {item.latestScan
                          ?.provider ?? '—'}
                      </td>
                      <td className="whitespace-nowrap">
                        {formatDate(
                          item.firstSeenAt,
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        {formatDate(
                          item.lastSeenAt,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-slate-500">
                Page {result?.page ?? page} of{' '}
                {result?.totalPages ?? 1}
              </span>

              <div className="flex gap-2">
                <button
                  className="secondary-button"
                  disabled={
                    loading ||
                    (result?.page ?? page) <= 1
                  }
                  onClick={() =>
                    updateParam(
                      'page',
                      String(
                        Math.max(
                          1,
                          (result?.page ??
                            page) - 1,
                        ),
                      ),
                      false,
                    )
                  }
                >
                  Previous
                </button>

                <button
                  className="secondary-button"
                  disabled={
                    loading ||
                    (result?.page ?? page) >=
                      (result?.totalPages ?? 1)
                  }
                  onClick={() =>
                    updateParam(
                      'page',
                      String(
                        (result?.page ??
                          page) + 1,
                      ),
                      false,
                    )
                  }
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <p className="text-sm font-semibold text-slate-300">
              No public artifacts found
            </p>
            <p className="mt-1 max-w-lg text-sm leading-6 text-slate-500">
              Try a different query or filter.
              Private submissions are intentionally
              excluded.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
