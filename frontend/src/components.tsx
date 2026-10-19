import { FormEvent, useEffect, useState } from 'react';
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useAuth, useAuthForm } from './auth';

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 160 160" role="img" aria-label="GO VIRUS logo">
      <defs>
        <linearGradient id="brand-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="55%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#84cc16" />
        </linearGradient>
        <linearGradient id="brand-b" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a3e635" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <circle cx="80" cy="80" r="62" fill="none" stroke="#17365f" strokeWidth="6" />
      <circle cx="80" cy="80" r="50" fill="none" stroke="#155e75" strokeWidth="2" />
      <circle cx="80" cy="80" r="37" fill="none" stroke="#164e63" strokeWidth="2" />
      <path d="M34 54 L55 54 L80 90 L106 54 L128 54 L80 126 Z" fill="none" stroke="url(#brand-a)" strokeWidth="10" strokeLinejoin="round" />
      <path d="M48 42 L80 82 L122 32" fill="none" stroke="url(#brand-b)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <g fill="#22d3ee">
        <circle cx="26" cy="74" r="4" />
        <circle cx="132" cy="72" r="4" />
        <circle cx="52" cy="22" r="3" />
        <circle cx="108" cy="136" r="3" />
      </g>
      <g fill="#84cc16">
        <circle cx="43" cy="121" r="4" />
        <circle cx="120" cy="42" r="4" />
      </g>
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function AuthPanel({ onClose }: { onClose: () => void }) {
  const { mode, setMode, form, setForm, busy, message, submit } = useAuthForm();
  const { user } = useAuth();

  useEffect(() => {
    if (user) onClose();
  }, [user, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 p-4 pt-20" onClick={onClose}>
      <section
        className="w-full max-w-sm border border-[#304568] bg-[#111a2d] p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
          <button className="text-slate-400 hover:text-white" onClick={onClose}>×</button>
        </div>

        <div className="mb-4 flex border border-[#2f4363]">
          <button
            type="button"
            className={'flex-1 px-3 py-2 text-sm ' + (mode === 'login' ? 'bg-[#1d2c47] text-white' : 'text-slate-400')}
            onClick={() => setMode('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={'flex-1 px-3 py-2 text-sm ' + (mode === 'register' ? 'bg-[#1d2c47] text-white' : 'text-slate-400')}
            onClick={() => setMode('register')}
          >
            Sign up
          </button>
        </div>

        <form className="space-y-3" onSubmit={submit}>
          {mode === 'register' && (
            <input
              className="dark-control"
              placeholder="Username"
              value={form.username}
              onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
            />
          )}
          <input
            className="dark-control"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
          <input
            className="dark-control"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
          />
          {message && <p className="text-sm text-slate-400">{message}</p>}
          <button className="scan-button w-full" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </section>
    </div>
  );
}

const navItems = [
  ['/', 'File'],
  ['/url', 'URL'],
  ['/search', 'Search'],
  ['/history', 'History'],
  ['/notifications', 'Notifications'],
  ['/llm', 'AI'],
  ['/api-keys', 'API keys'],
] as const;

export function AppShell() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    setSearch(new URLSearchParams(location.search).get('q') ?? '');
  }, [location.search]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? '/search?q=' + encodeURIComponent(query) : '/search');
  }

  return (
    <div className="min-h-screen bg-[#0b1020] text-slate-100">
      <header className="border-b border-[#243455] bg-[#17223b]">
        <div className="flex min-h-16 items-center gap-4 px-4 py-2 lg:px-6">
          <button className="flex shrink-0 items-center gap-2" onClick={() => navigate('/')}>
            <BrandMark className="h-10 w-10" />
            <span className="hidden text-lg font-bold tracking-wide sm:block">
              <span className="text-cyan-300">GO</span>{' '}
              <span className="text-lime-300">VIRUS</span>
            </span>
          </button>

          <form
            className="mx-auto flex max-w-3xl flex-1 items-center rounded-md border border-[#34486e] bg-[#111a30] px-4 text-slate-400"
            onSubmit={submitSearch}
          >
            <SearchIcon />
            <input
              className="w-full bg-transparent px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-500"
              placeholder="Search by file hash or artifact ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </form>

          <div className="flex shrink-0 items-center gap-3">
            {auth.user ? (
              <>
                <span className="hidden text-sm text-slate-300 md:inline">{auth.user.username}</span>
                <button className="nav-link" onClick={() => void auth.signOut()}>Sign out</button>
              </>
            ) : (
              <>
                <button className="nav-link" onClick={() => setAuthOpen(true)}>Sign in</button>
                <button className="signup-button" onClick={() => setAuthOpen(true)}>Sign up</button>
              </>
            )}
          </div>
        </div>

        <nav className="overflow-x-auto border-t border-[#22314e] bg-[#121b30]">
          <div className="mx-auto flex min-w-max max-w-7xl items-center gap-1 px-4 lg:px-6">
            {navItems.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  'border-b-2 px-3 py-2.5 text-sm transition ' +
                  (isActive
                    ? 'border-cyan-400 text-white'
                    : 'border-transparent text-slate-400 hover:text-white')
                }
              >
                {label}
              </NavLink>
            ))}

            {(auth.user?.role === 'MODERATOR' || auth.user?.role === 'ADMIN') && (
              <NavLink
                to="/moderation"
                className={({ isActive }) =>
                  'border-b-2 px-3 py-2.5 text-sm ' +
                  (isActive ? 'border-cyan-400 text-white' : 'border-transparent text-slate-400')
                }
              >
                Moderation
              </NavLink>
            )}

            {auth.user?.role === 'ADMIN' && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  'border-b-2 px-3 py-2.5 text-sm ' +
                  (isActive ? 'border-cyan-400 text-white' : 'border-transparent text-slate-400')
                }
              >
                Admin
              </NavLink>
            )}

            <NavLink
              to="/profile/security"
              className={({ isActive }) =>
                'border-b-2 px-3 py-2.5 text-sm ' +
                (isActive ? 'border-cyan-400 text-white' : 'border-transparent text-slate-400')
              }
            >
              Security
            </NavLink>
          </div>
        </nav>
      </header>

      {authOpen && <AuthPanel onClose={() => setAuthOpen(false)} />}
      <Outlet />
    </div>
  );
}

export function FeaturePending({
  title,
  description,
  requirement,
}: {
  title: string;
  description: string;
  requirement?: string;
}) {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="border border-[#263753] bg-[#11192b] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">
          Backend endpoint pending
        </p>
        <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
        {requirement && (
          <div className="mt-5 border-l-2 border-[#4d8fe8] bg-[#0e1628] px-4 py-3 text-sm text-slate-300">
            {requirement}
          </div>
        )}
      </div>
    </main>
  );
}
