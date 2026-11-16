import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { BrandMark, Icon, Spinner, VerdictPill, Wordmark } from '../components';
import { claimPendingScan, readPendingScan } from '../lib/pending';

function safeNext(value: string | null) {
  // Only allow in-app paths to avoid open redirects.
  return value && value.startsWith('/app') ? value : '/app';
}

function passwordStrength(value: string) {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;
  return score;
}

const STRENGTH = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLOR = ['bg-slate-700', 'bg-rose-500', 'bg-amber-400', 'bg-blue-400', 'bg-emerald-400'];

export default function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const pending = readPendingScan();

  const [form, setForm] = useState({ username: '', email: '', password: '', totpCode: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setTwoFactor(false);
  }, [mode]);

  // Already signed in: go straight to the destination.
  useEffect(() => {
    if (!auth.loading && auth.user && !busy) navigate(next, { replace: true });
  }, [auth.loading, auth.user, busy, navigate, next]);

  async function finish(token: string | null) {
    const claimed = token ? await claimPendingScan(token) : null;
    navigate(claimed && next === '/app' ? '/app/artifact/' + claimed : next, { replace: true });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const result =
        mode === 'signup'
          ? await auth.register(form.username.trim(), form.email.trim(), form.password)
          : await auth.signIn(form.email.trim(), form.password, twoFactor ? form.totpCode : undefined);

      if (result === 'TWO_FACTOR_REQUIRED') {
        setTwoFactor(true);
        setBusy(false);
        return;
      }

      await finish(localStorage.getItem('session_token'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  }

  const strength = passwordStrength(form.password);
  const switchTo = (mode === 'login' ? '/signup' : '/login') + location.search;

  return (
    <div className="grid min-h-screen bg-ink lg:grid-cols-[1fr_1.05fr]">
      {/* Form */}
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link to="/" className="flex items-center gap-2.5 self-start">
          <BrandMark className="h-8 w-8" />
          <Wordmark />
        </Link>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">
          <h1 className="display text-[34px] text-white">
            {twoFactor ? 'Enter your code' : mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="mt-3 text-[15px] leading-6 text-slate-400">
            {twoFactor
              ? 'Open your authenticator app and enter the 6-digit code for GO VIRUS.'
              : mode === 'login'
                ? 'Sign in to your reports, history and API keys.'
                : 'Free forever. Full reports, private scans and an API key.'}
          </p>

          <form className="mt-8 space-y-4" onSubmit={submit}>
            {twoFactor ? (
              <div>
                <label className="field-label" htmlFor="totp">Authentication code</label>
                <input
                  id="totp"
                  className="app-input text-center font-mono text-xl tracking-[0.5em]"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  placeholder="000000"
                  value={form.totpCode}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, totpCode: event.target.value.replace(/\D/g, '').slice(0, 6) }))
                  }
                />
              </div>
            ) : (
              <>
                {mode === 'signup' && (
                  <div>
                    <label className="field-label" htmlFor="username">Username</label>
                    <input
                      id="username"
                      className="app-input"
                      autoComplete="username"
                      required
                      minLength={3}
                      maxLength={50}
                      placeholder="jdoe"
                      value={form.username}
                      onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                    />
                    <p className="field-hint">Shown next to your comments and public scans.</p>
                  </div>
                )}
                <div>
                  <label className="field-label" htmlFor="email">Email</label>
                  <input
                    id="email"
                    className="app-input"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@company.com"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="password">Password</label>
                  <div className="relative">
                    <input
                      id="password"
                      className="app-input pr-16"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      required
                      minLength={mode === 'signup' ? 8 : undefined}
                      value={form.password}
                      onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-slate-400 hover:text-white"
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {mode === 'signup' && form.password && (
                    <div className="mt-2.5">
                      <div className="grid grid-cols-4 gap-1">
                        {[1, 2, 3, 4].map((step) => (
                          <span
                            key={step}
                            className={'h-1 rounded-full ' + (strength >= step ? STRENGTH_COLOR[strength] : 'bg-slate-800')}
                          />
                        ))}
                      </div>
                      <p className="field-hint">{STRENGTH[strength]}. Use at least 8 characters.</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-200">
                <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button className="primary-button w-full py-3" disabled={busy || (twoFactor && form.totpCode.length !== 6)}>
              {busy && <Spinner />}
              {twoFactor ? 'Verify and sign in' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {!twoFactor && (
            <p className="mt-6 text-sm text-slate-400">
              {mode === 'login' ? 'New to GO VIRUS? ' : 'Already have an account? '}
              <Link className="text-link" to={switchTo}>
                {mode === 'login' ? 'Create an account' : 'Sign in'}
              </Link>
            </p>
          )}
          {twoFactor && (
            <button className="text-link mt-6 self-start" onClick={() => setTwoFactor(false)}>
              Use a different account
            </button>
          )}
        </div>
      </div>

      {/* Context panel */}
      <div className="relative hidden overflow-hidden border-l border-slate-800 lg:block">
        <div className="landing-grid-bg" />
        <div className="landing-glow -right-72 top-10" />
        <div className="relative flex h-full flex-col justify-center px-14 py-16">
          {pending ? (
            <div className="chamber max-w-md p-7">
              <span className="chamber-corner tl" />
              <span className="chamber-corner tr" />
              <span className="chamber-corner bl" />
              <span className="chamber-corner br" />
              <div className="relative">
                <p className="text-sm text-slate-400">Your report is waiting</p>
                <p className="display-tight mt-1 break-all text-2xl text-white">{pending.name}</p>
                <div className="mt-4">
                  <VerdictPill verdict={pending.verdict} />
                </div>
                <p className="mt-5 text-[15px] leading-7 text-slate-300">
                  {mode === 'signup' ? 'Create your account' : 'Sign in'} and we'll open the full report and save this scan
                  to your history.
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-lg">
              <h2 className="display text-[40px] text-white">One place for every file you weren't sure about.</h2>
              <ul className="mt-10 space-y-5">
                {[
                  ['Full multi-engine reports', 'Every engine, every detection name, every hash.'],
                  ['Private scans', 'Kept on our own ClamAV engine and never shared.'],
                  ['History and alerts', 'Know when a rescan or reply needs your attention.'],
                ].map(([title, body]) => (
                  <li key={title} className="flex gap-4">
                    <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                      <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.6} />
                    </span>
                    <span>
                      <span className="block font-semibold text-white">{title}</span>
                      <span className="mt-0.5 block text-sm leading-6 text-slate-400">{body}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
