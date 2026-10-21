import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { PageHeader, StatusNotice } from '../components';

export default function SecurityPage() {
  const { token, user } = useAuth();
  const [status, setStatus] = useState<{
    enabled: boolean;
    configured: boolean;
  } | null>(null);
  const [setup, setSetup] = useState<{
    secret: string;
    otpauthUri: string;
  } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    if (!token) return;

    try {
      setStatus(await api.twoFactorStatus(token));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load security settings',
      );
    }
  }

  useEffect(() => {
    void loadStatus();
  }, [token]);

  async function beginSetup() {
    if (!token) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const result = await api.setupTwoFactor(token);
      setSetup(result);
      setCode('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not start two-factor setup',
      );
    } finally {
      setBusy(false);
    }
  }

  async function enable(event: FormEvent) {
    event.preventDefault();
    if (!token || code.length !== 6) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await api.enableTwoFactor(code, token);
      setSetup(null);
      setCode('');
      setMessage('Two-factor authentication is now enabled.');
      await loadStatus();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not enable two-factor authentication',
      );
    } finally {
      setBusy(false);
    }
  }

  async function disable(event: FormEvent) {
    event.preventDefault();
    if (!token || code.length !== 6) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await api.disableTwoFactor(code, token);
      setCode('');
      setMessage('Two-factor authentication has been disabled.');
      await loadStatus();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not disable two-factor authentication',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!user || !token) {
    return (
      <main className="app-page">
        <PageHeader
          title="Security"
          description="Manage account security and two-factor authentication."
        />
        <StatusNotice title="Sign in required">
          Account security settings are only available to authenticated users.
        </StatusNotice>
      </main>
    );
  }

  return (
    <main className="app-page">
      <PageHeader
        title="Security"
        description="Protect your GO VIRUS account with a time-based authenticator code."
      />

      <div className="max-w-3xl space-y-5">
        {error && (
          <div className="rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-lg border border-emerald-900 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
            {message}
          </div>
        )}

        {!status?.configured && (
          <StatusNotice title="Server configuration required">
            Set TWO_FACTOR_ENCRYPTION_KEY in the project .env to a stable random value of at least 32 characters, then restart the stack.
          </StatusNotice>
        )}

        <section className="surface">
          <div className="surface-header flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">
                Authenticator app
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                TOTP · 6 digits · 30-second codes
              </p>
            </div>
            <span
              className={
                'status-badge ' +
                (status?.enabled
                  ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300'
                  : 'border-slate-700 bg-slate-900 text-slate-400')
              }
            >
              {status?.enabled ? 'ENABLED' : 'DISABLED'}
            </span>
          </div>

          <div className="surface-body">
            {!status?.enabled && !setup && (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-300">
                    Require an authenticator code after your password when signing in.
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Compatible with Google Authenticator, Microsoft Authenticator, 1Password and other TOTP apps.
                  </p>
                </div>
                <button
                  className="primary-button shrink-0"
                  disabled={busy || !status?.configured}
                  onClick={() => void beginSetup()}
                >
                  {busy ? 'Preparing…' : 'Set up 2FA'}
                </button>
              </div>
            )}

            {!status?.enabled && setup && (
              <form className="space-y-5" onSubmit={enable}>
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">
                    Add GO VIRUS to your authenticator
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Add a new account manually in your authenticator app and enter this setup key. Keep it private.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-600">
                    Setup key
                  </p>
                  <p className="mt-2 break-all font-mono text-sm tracking-wider text-cyan-300">
                    {setup.secret}
                  </p>
                </div>

                <details className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                  <summary className="cursor-pointer text-sm text-slate-400">
                    Advanced: otpauth URI
                  </summary>
                  <p className="mt-3 break-all font-mono text-xs leading-5 text-slate-600">
                    {setup.otpauthUri}
                  </p>
                </details>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-400">
                    Verify with the current 6-digit code
                  </span>
                  <input
                    className="app-input max-w-xs"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={code}
                    maxLength={6}
                    onChange={(event) =>
                      setCode(
                        event.target.value
                          .replace(/\D/g, '')
                          .slice(0, 6),
                      )
                    }
                  />
                </label>

                <div className="flex gap-3">
                  <button
                    className="primary-button"
                    disabled={busy || code.length !== 6}
                  >
                    {busy ? 'Verifying…' : 'Enable 2FA'}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => {
                      setSetup(null);
                      setCode('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {status?.enabled && (
              <form className="space-y-4" onSubmit={disable}>
                <div>
                  <p className="text-sm text-slate-300">
                    Two-factor authentication is protecting your account.
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    To disable it, confirm with a current code from your authenticator app.
                  </p>
                </div>

                <input
                  className="app-input max-w-xs"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit authenticator code"
                  value={code}
                  maxLength={6}
                  onChange={(event) =>
                    setCode(
                      event.target.value
                        .replace(/\D/g, '')
                        .slice(0, 6),
                    )
                  }
                />

                <button
                  className="secondary-button"
                  disabled={busy || code.length !== 6}
                >
                  {busy ? 'Disabling…' : 'Disable 2FA'}
                </button>
              </form>
            )}
          </div>
        </section>

        <StatusNotice title="Secret storage">
          Authenticator secrets are encrypted with AES-256-GCM before they are stored in PostgreSQL. The encryption key stays in your local environment configuration.
        </StatusNotice>
      </div>
    </main>
  );
}
