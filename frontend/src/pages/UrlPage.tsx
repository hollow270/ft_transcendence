import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { PageHeader, StatusNotice } from '../components';
import type { ScannerCapabilities } from '../types';

export default function UrlPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [url, setUrl] = useState('');
  const [visibility, setVisibility] =
    useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [forceRescan, setForceRescan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [scanner, setScanner] =
    useState<ScannerCapabilities | null>(null);

  useEffect(() => {
    api
      .scannerCapabilities()
      .then(setScanner)
      .catch(() => setScanner(null));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();

    const value = url.trim();

    if (!value) {
      setMessage('Enter a URL before starting analysis.');
      return;
    }

    try {
      const parsed = new URL(value);
      if (
        parsed.protocol !== 'http:' &&
        parsed.protocol !== 'https:'
      ) {
        setMessage('Only http and https URLs are supported.');
        return;
      }
    } catch {
      setMessage('Enter a valid absolute URL.');
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const result = await api.submitUrl(
        value,
        {
          visibility,
          forceRescan,
        },
        token,
      );

      navigate('/artifact/' + result.artifact.id, {
        state: {
          reusedScan: result.reusedScan,
          submissionVisibility:
            result.submission.visibility,
        },
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'URL analysis failed',
      );
    } finally {
      setBusy(false);
    }
  }

  const virusTotalReady =
    scanner?.engines.some(
      (engine) =>
        engine.name === 'virustotal' &&
        engine.configured,
    ) ?? false;

  return (
    <main className="app-page">
      <PageHeader
        title="URL analysis"
        description="Normalize, deduplicate and analyze a URL with the configured reputation provider."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="surface">
          <div className="surface-header flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">
                Analyze URL
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                HTTP and HTTPS only
              </p>
            </div>

            {scanner && (
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-slate-400">
                  Mode: {scanner.provider}
                </span>
                <span
                  className={
                    'rounded-full border px-2.5 py-1 ' +
                    (virusTotalReady
                      ? 'border-emerald-800 bg-emerald-950/30 text-emerald-300'
                      : 'border-amber-800 bg-amber-950/30 text-amber-300')
                  }
                >
                  VirusTotal: {virusTotalReady ? 'ready' : 'not configured'}
                </span>
              </div>
            )}
          </div>

          <form
            className="surface-body space-y-5"
            onSubmit={submit}
          >
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-400">
                URL
              </span>
              <input
                className="app-input"
                type="url"
                value={url}
                onChange={(event) =>
                  setUrl(event.target.value)
                }
                placeholder="https://example.com/path"
                maxLength={4096}
                autoComplete="off"
              />
            </label>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-wrap gap-4">
                <label>
                  <span className="mb-1.5 block text-xs font-medium text-slate-400">
                    Visibility
                  </span>
                  <select
                    className="gv-compact-select"
                    value={visibility}
                    onChange={(event) =>
                      setVisibility(
                        event.target.value as
                          | 'PUBLIC'
                          | 'PRIVATE',
                      )
                    }
                  >
                    <option value="PUBLIC">
                      Public
                    </option>
                    <option
                      value="PRIVATE"
                      disabled={!user}
                    >
                      Private
                    </option>
                  </select>
                </label>

                <label className="gv-checkbox self-end">
                  <input
                    type="checkbox"
                    checked={forceRescan}
                    onChange={(event) =>
                      setForceRescan(
                        event.target.checked,
                      )
                    }
                  />
                  <span>Force rescan</span>
                </label>
              </div>

              <button
                className="primary-button"
                disabled={busy}
              >
                {busy
                  ? 'Analyzing…'
                  : 'Analyze URL'}
              </button>
            </div>

            {visibility === 'PRIVATE' &&
              scanner?.provider !== 'development' && (
                <div className="rounded-lg border border-sky-900 bg-sky-950/20 px-4 py-3 text-sm leading-6 text-sky-200">
                  Private URLs are not sent to VirusTotal. GO VIRUS can reuse a fresh public result for the same normalized URL, but a new private external analysis is blocked.
                </div>
              )}

            {message && (
              <div className="gv-inline-error">
                {message}
              </div>
            )}
          </form>
        </section>

        <div className="space-y-5">
          <StatusNotice title="Normalization">
            GO VIRUS removes the URL fragment, normalizes the host and default port, and hashes the normalized URL for deduplication. Query strings and paths are preserved.
          </StatusNotice>

          {!virusTotalReady &&
            scanner?.provider !== 'development' && (
              <StatusNotice title="VirusTotal key required">
                A real new URL analysis needs VirusTotal configured in your local environment.
              </StatusNotice>
            )}
        </div>
      </div>
    </main>
  );
}
