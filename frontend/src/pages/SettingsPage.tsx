import { FormEvent, ReactNode, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Avatar, Icon, PageHeader, Spinner, timeAgo } from '../components';
import type { AccountSession } from '../types';

function describeAgent(agent: string | null) {
  if (!agent) return { device: 'Unknown device', browser: 'Signed in before device tracking' };
  const browser = /Edg\//.test(agent)
    ? 'Edge'
    : /Firefox\//.test(agent)
      ? 'Firefox'
      : /Chrome\//.test(agent)
        ? 'Chrome'
        : /Safari\//.test(agent)
          ? 'Safari'
          : /curl|python|node|axios/i.test(agent)
            ? 'Script'
            : 'Browser';
  const os = /Windows/.test(agent)
    ? 'Windows'
    : /iPhone|iPad/.test(agent)
      ? 'iOS'
      : /Android/.test(agent)
        ? 'Android'
        : /Mac OS X|Macintosh/.test(agent)
          ? 'macOS'
          : /Linux/.test(agent)
            ? 'Linux'
            : 'Unknown OS';
  return { device: browser + ' on ' + os, browser: agent.slice(0, 90) };
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-slate-800 py-10 first:border-t-0 first:pt-0 lg:grid-cols-[280px_1fr]">
      <div>
        <h2 className="display-tight text-lg text-white">{title}</h2>
        <p className="mt-1.5 text-sm leading-6 text-slate-400">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

function Feedback({ kind, children }: { kind: 'ok' | 'error'; children: ReactNode }) {
  return (
    <p
      className={
        'mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ' +
        (kind === 'ok'
          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
          : 'border-rose-500/30 bg-rose-500/10 text-rose-200')
      }
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <Icon name={kind === 'ok' ? 'check' : 'alert'} className="h-4 w-4 shrink-0" />
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */

function ProfileForm() {
  const { token, user, refreshUser } = useAuth();
  const [username, setUsername] = useState(user?.username ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const emailChanged = email.trim().toLowerCase() !== (user?.email ?? '');
  const dirty = username.trim() !== user?.username || emailChanged;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setBusy(true);
    setResult(null);
    try {
      await api.updateProfile(
        { username: username.trim(), email: email.trim(), ...(emailChanged ? { currentPassword } : {}) },
        token,
      );
      await refreshUser();
      setCurrentPassword('');
      setResult({ kind: 'ok', text: 'Profile saved.' });
    } catch (err) {
      setResult({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save your profile.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="surface p-6" onSubmit={submit}>
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={username || user?.username || '?'} size={56} />
        <div>
          <p className="font-semibold text-white">{user?.username}</p>
          <p className="text-sm text-slate-500">
            Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : '—'}
          </p>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="username">Username</label>
          <input id="username" className="app-input" value={username} onChange={(event) => setUsername(event.target.value)} maxLength={50} />
          <p className="field-hint">Letters, numbers, dot, dash and underscore.</p>
        </div>
        <div>
          <label className="field-label" htmlFor="email">Email</label>
          <input id="email" type="email" className="app-input" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        {emailChanged && (
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="confirm-password">Current password</label>
            <input
              id="confirm-password"
              type="password"
              className="app-input sm:max-w-sm"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
            <p className="field-hint">Required to change the email you sign in with.</p>
          </div>
        )}
      </div>
      {result && <Feedback kind={result.kind}>{result.text}</Feedback>}
      <div className="mt-6 flex justify-end gap-2 border-t border-slate-800 pt-5">
        <button
          type="button"
          className="ghost-button"
          disabled={!dirty || busy}
          onClick={() => {
            setUsername(user?.username ?? '');
            setEmail(user?.email ?? '');
            setResult(null);
          }}
        >
          Reset
        </button>
        <button className="primary-button" disabled={!dirty || busy || (emailChanged && !currentPassword)}>
          {busy && <Spinner />} Save profile
        </button>
      </div>
    </form>
  );
}

function PasswordForm({ onChanged }: { onChanged: () => void }) {
  const { token } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const mismatch = form.confirm.length > 0 && form.next !== form.confirm;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token || mismatch) return;
    setBusy(true);
    setResult(null);
    try {
      const response = await api.changePassword({ currentPassword: form.current, newPassword: form.next }, token);
      setForm({ current: '', next: '', confirm: '' });
      setResult({
        kind: 'ok',
        text:
          'Password changed.' +
          (response.revokedSessions ? ' ' + response.revokedSessions + ' other device(s) were signed out.' : ''),
      });
      onChanged();
    } catch (err) {
      setResult({ kind: 'error', text: err instanceof Error ? err.message : 'Could not change your password.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="surface p-6" onSubmit={submit}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2 sm:max-w-sm">
          <label className="field-label" htmlFor="pw-current">Current password</label>
          <input id="pw-current" type="password" autoComplete="current-password" className="app-input" value={form.current} onChange={(event) => setForm({ ...form, current: event.target.value })} />
        </div>
        <div>
          <label className="field-label" htmlFor="pw-new">New password</label>
          <input id="pw-new" type="password" autoComplete="new-password" minLength={8} className="app-input" value={form.next} onChange={(event) => setForm({ ...form, next: event.target.value })} />
          <p className="field-hint">At least 8 characters.</p>
        </div>
        <div>
          <label className="field-label" htmlFor="pw-confirm">Confirm new password</label>
          <input id="pw-confirm" type="password" autoComplete="new-password" className={'app-input ' + (mismatch ? 'border-rose-500/60' : '')} value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} />
          {mismatch && <p className="field-hint text-rose-300">Passwords don't match.</p>}
        </div>
      </div>
      {result && <Feedback kind={result.kind}>{result.text}</Feedback>}
      <div className="mt-6 flex justify-end border-t border-slate-800 pt-5">
        <button className="primary-button" disabled={busy || !form.current || form.next.length < 8 || form.next !== form.confirm}>
          {busy && <Spinner />} Change password
        </button>
      </div>
    </form>
  );
}

function SessionsList({ reloadKey }: { reloadKey: number }) {
  const { token } = useAuth();
  const [sessions, setSessions] = useState<AccountSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    api.sessions(token).then(setSessions).catch((err) => setError(err instanceof Error ? err.message : 'Could not load sessions'));
  }, [token]);

  useEffect(load, [load, reloadKey]);

  async function revoke(id: string) {
    if (!token) return;
    setWorking(id);
    try {
      await api.revokeSession(id, token);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign that device out');
    } finally {
      setWorking(null);
    }
  }

  async function revokeOthers() {
    if (!token) return;
    setWorking('others');
    try {
      await api.revokeOtherSessions(token);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign out other devices');
    } finally {
      setWorking(null);
    }
  }

  const others = sessions?.filter((session) => !session.current).length ?? 0;

  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
        <p className="text-sm text-slate-400">
          {sessions ? sessions.length + ' active session' + (sessions.length === 1 ? '' : 's') : 'Loading'}
        </p>
        <button className="secondary-button py-2 text-xs" disabled={!others || working !== null} onClick={() => void revokeOthers()}>
          {working === 'others' && <Spinner className="h-3.5 w-3.5" />}
          Sign out all other devices
        </button>
      </div>
      {error && <div className="px-5"><Feedback kind="error">{error}</Feedback></div>}
      <ul className="divide-y divide-slate-800">
        {sessions?.map((session) => {
          const agent = describeAgent(session.userAgent);
          return (
            <li key={session.id} className="flex items-center gap-4 px-5 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-slate-400">
                <Icon name="monitor" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium text-white">
                  {agent.device}
                  {session.current && (
                    <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-300">This device</span>
                  )}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  Signed in {timeAgo(session.createdAt)}, last active {timeAgo(session.lastSeenAt)}
                </p>
              </div>
              {!session.current && (
                <button className="ghost-button text-xs text-rose-300 hover:text-rose-200" disabled={working !== null} onClick={() => void revoke(session.id)}>
                  {working === session.id ? <Spinner className="h-3.5 w-3.5" /> : 'Sign out'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DangerZone() {
  const { token, user, forgetSession } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount({ password, confirm }, token);
      forgetSession();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the account');
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.04] p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-white">Delete account</p>
          <p className="mt-1 max-w-lg text-sm leading-6 text-slate-400">
            Signs out every device, revokes your API keys and removes your sign-in details. Public scan reports stay
            available to the community without your name.
          </p>
        </div>
        {!open && (
          <button className="danger-button shrink-0" onClick={() => setOpen(true)}>
            Delete account
          </button>
        )}
      </div>

      {open && (
        <form className="mt-6 grid gap-4 border-t border-rose-500/20 pt-6 sm:grid-cols-2" onSubmit={submit}>
          <div>
            <label className="field-label" htmlFor="del-password">Password</label>
            <input id="del-password" type="password" className="app-input" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="del-confirm">
              Type <span className="font-mono text-rose-300">{user?.username}</span> to confirm
            </label>
            <input id="del-confirm" className="app-input" autoComplete="off" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          </div>
          {error && <div className="sm:col-span-2"><Feedback kind="error">{error}</Feedback></div>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="ghost-button" onClick={() => setOpen(false)}>Cancel</button>
            <button className="danger-button" disabled={busy || !password || confirm !== user?.username}>
              {busy && <Spinner />} Permanently delete my account
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [sessionsKey, setSessionsKey] = useState(0);

  return (
    <div className="app-page max-w-6xl">
      <PageHeader title="Profile & sessions" description="Manage how you appear, how you sign in, and where you're signed in." />

      <Section title="Profile" description="Your username is public on comments and public scans. Your email is never shown.">
        <ProfileForm />
      </Section>

      <Section title="Password" description="Changing your password signs out every other device.">
        <PasswordForm onChanged={() => setSessionsKey((value) => value + 1)} />
      </Section>

      <Section title="Signed-in devices" description="Every browser and script currently signed in to your account. Sign out anything you don't recognise.">
        <SessionsList reloadKey={sessionsKey} />
      </Section>

      <Section title="Danger zone" description="This can't be undone.">
        <DangerZone />
      </Section>
    </div>
  );
}
