import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { PageHeader, StatusNotice } from '../components';
import type { ApiKeyInfo, CreatedApiKey } from '../types';

function formatDate(value?: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

export default function ApiKeysPage() {
  const { token, user } = useAuth();
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [name, setName] = useState('');
  const [created, setCreated] =
    useState<CreatedApiKey | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      setKeys(await api.apiKeys(token));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load API keys',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function createKey(event: FormEvent) {
    event.preventDefault();
    if (!token || !name.trim()) return;

    setBusy(true);
    setError(null);
    setCreated(null);

    try {
      const result = await api.createApiKey(
        name.trim(),
        token,
      );
      setCreated(result);
      setName('');
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not create API key',
      );
    } finally {
      setBusy(false);
    }
  }

  async function revoke(apiKeyId: string) {
    if (!token) return;

    setBusy(true);
    setError(null);

    try {
      await api.revokeApiKey(apiKeyId, token);
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not revoke API key',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!user || !token) {
    return (
      <main className="app-page">
        <PageHeader
          title="API keys"
          description="Create and revoke credentials for the GO VIRUS public API."
        />
        <StatusNotice title="Sign in required">
          API credentials belong to a registered account.
        </StatusNotice>
      </main>
    );
  }

  return (
    <main className="app-page">
      <PageHeader
        title="API keys"
        description="Use API keys to call the authenticated GO VIRUS public API."
      />

      <div className="space-y-5">
        {error && (
          <div className="rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {created && (
          <section className="surface">
            <div className="surface-header">
              <h2 className="text-sm font-semibold text-emerald-300">
                API key created
              </h2>
            </div>
            <div className="surface-body space-y-3">
              <p className="text-sm text-slate-400">
                Copy this key now. GO VIRUS stores only its SHA-256 hash and cannot show the plaintext again.
              </p>
              <div className="rounded-lg border border-emerald-900 bg-slate-950 p-4">
                <code className="break-all text-sm text-emerald-300">
                  {created.key}
                </code>
              </div>
              <button
                className="secondary-button"
                onClick={() =>
                  void navigator.clipboard.writeText(
                    created.key,
                  )
                }
              >
                Copy key
              </button>
            </div>
          </section>
        )}

        <section className="surface">
          <div className="surface-header">
            <h2 className="text-sm font-semibold text-slate-200">
              Create API key
            </h2>
          </div>
          <form
            className="surface-body flex flex-col gap-3 sm:flex-row"
            onSubmit={createKey}
          >
            <input
              className="app-input"
              placeholder="Example: local development"
              value={name}
              maxLength={100}
              onChange={(event) =>
                setName(event.target.value)
              }
            />
            <button
              className="primary-button shrink-0"
              disabled={busy || !name.trim()}
            >
              {busy ? 'Creating…' : 'Create API key'}
            </button>
          </form>
        </section>

        <section className="surface overflow-hidden">
          <div className="surface-header">
            <h2 className="text-sm font-semibold text-slate-200">
              Your API keys
            </h2>
          </div>

          {loading ? (
            <div className="empty-state">
              <p className="text-sm text-slate-500">
                Loading API keys…
              </p>
            </div>
          ) : keys.length ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Prefix</th>
                    <th>Rate limit</th>
                    <th>Last used</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => (
                    <tr key={key.id}>
                      <td>{key.name}</td>
                      <td className="font-mono text-xs">
                        {key.keyPrefix}…
                      </td>
                      <td>
                        {key.rateLimitPerMinute}/min
                      </td>
                      <td className="whitespace-nowrap">
                        {formatDate(key.lastUsedAt)}
                      </td>
                      <td>
                        <span
                          className={
                            'status-badge ' +
                            (key.revokedAt
                              ? 'border-slate-700 bg-slate-900 text-slate-500'
                              : 'border-emerald-800 bg-emerald-950/40 text-emerald-300')
                          }
                        >
                          {key.revokedAt
                            ? 'REVOKED'
                            : 'ACTIVE'}
                        </span>
                      </td>
                      <td>
                        {!key.revokedAt && (
                          <button
                            className="secondary-button"
                            disabled={busy}
                            onClick={() =>
                              void revoke(key.id)
                            }
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p className="text-sm font-semibold text-slate-300">
                No API keys yet
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Create a key above to use the public API.
              </p>
            </div>
          )}
        </section>

        <section className="surface">
          <div className="surface-header">
            <h2 className="text-sm font-semibold text-slate-200">
              Public API
            </h2>
          </div>
          <div className="surface-body space-y-4 text-sm text-slate-400">
            <p>
              Send the key in the <code className="text-cyan-300">X-API-Key</code> header.
              API submissions are always public and are recorded with source <code>API</code>.
            </p>
            <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs leading-6 text-slate-400">
              {'GET  http://localhost:3000/api/v1/search?q=example.com\nGET  http://localhost:3000/api/v1/artifacts/{artifactId}\nPOST http://localhost:3000/api/v1/urls\nPOST http://localhost:3000/api/v1/files'}
            </pre>
          </div>
        </section>
      </div>
    </main>
  );
}
