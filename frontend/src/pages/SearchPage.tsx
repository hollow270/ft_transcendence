import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { PageHeader } from '../components';
import type { SearchResult } from '../types';

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

export default function SearchPage() {
  const [params] = useSearchParams();
  const query = (params.get('q') ?? '').trim();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!query) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    api
      .searchArtifacts(query)
      .then((data) => {
        if (active) setResults(data);
      })
      .catch((err) => {
        if (active) {
          setResults([]);
          setError(err instanceof Error ? err.message : 'Search failed');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query]);

  return (
    <main className="app-page">
      <PageHeader
        title="Search"
        description="Search public GO VIRUS artifacts by filename, file hash, artifact ID, domain or URL."
      />

      <section className="surface overflow-hidden">
        <div className="surface-header flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Search results</h2>
            {query && <p className="mt-1 break-all text-xs text-slate-500">Query: {query}</p>}
          </div>
          <span className="text-xs text-slate-600">
            {loading ? 'Searching…' : results.length + ' result' + (results.length === 1 ? '' : 's')}
          </span>
        </div>

        {error ? (
          <div className="m-5 rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : !query ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-slate-600" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <h2 className="mt-3 text-sm font-semibold text-slate-300">Enter a search query</h2>
            <p className="mt-1 max-w-lg text-sm leading-6 text-slate-500">
              Use the search bar above for a filename, SHA-256, SHA-1, MD5, artifact ID, domain or URL.
            </p>
          </div>
        ) : loading ? (
          <div className="empty-state">
            <p className="text-sm text-slate-500">Searching public artifacts…</p>
          </div>
        ) : results.length ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Artifact</th>
                  <th>Type</th>
                  <th>Verdict</th>
                  <th>Status</th>
                  <th>Provider</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.id}>
                    <td className="max-w-xl">
                      <Link
                        to={'/artifact/' + result.id}
                        className="block min-w-0 text-slate-200 hover:text-cyan-300"
                      >
                        <span className="block truncate font-medium">{result.displayName}</span>
                        <span className="mt-1 block truncate font-mono text-xs text-slate-600">
                          {result.type === 'FILE' ? result.file?.sha256 : result.url?.normalizedUrl}
                        </span>
                      </Link>
                    </td>
                    <td>{result.type}</td>
                    <td><VerdictBadge value={result.latestScan?.verdict} /></td>
                    <td>{result.latestScan?.status ?? '—'}</td>
                    <td>{result.latestScan?.provider ?? '—'}</td>
                    <td className="whitespace-nowrap">{formatDate(result.lastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p className="text-sm font-semibold text-slate-300">No public artifacts found</p>
            <p className="mt-1 max-w-lg text-sm leading-6 text-slate-500">
              Private submissions are intentionally excluded from search.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
