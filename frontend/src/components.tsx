import { FormEvent, ReactNode, useEffect, useState } from 'react';
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
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <circle cx="80" cy="80" r="60" fill="none" stroke="#334155" strokeWidth="6" />
      <path
        d="M38 56 L58 56 L80 88 L105 56 L126 56 L80 124 Z"
        fill="none"
        stroke="url(#brand-a)"
        strokeWidth="10"
        strokeLinejoin="round"
      />
      <path
        d="M48 42 L80 82 L121 33"
        fill="none"
        stroke="url(#brand-a)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function NavIcon({ name }: { name: string }) {
  const common = "h-4 w-4";
  if (name === 'file') {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5" />
      </svg>
    );
  }
  if (name === 'search') {
    return <SearchIcon />;
  }
  if (name === 'history') {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6" /><path d="M4 4v4.6h4.6M12 8v5l3 2" />
      </svg>
    );
  }
  if (name === 'bell') {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </svg>
    );
  }
  if (name === 'brain') {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 4a3 3 0 0 0-5 2.2A3.5 3.5 0 0 0 4 13a3 3 0 0 0 3 5h2M15 4a3 3 0 0 1 5 2.2A3.5 3.5 0 0 1 20 13a3 3 0 0 1-3 5h-2M9 4v16M15 4v16M9 8h6M9 16h6" />
      </svg>
    );
  }
  if (name === 'key') {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="8" cy="15" r="4" /><path d="m11 12 8-8M15 8l2 2M17 6l2 2" />
      </svg>
    );
  }
  if (name === 'shield') {
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
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
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/45 p-4 pt-16" onClick={onClose}>
      <section
        className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
          <button className="text-slate-400 hover:text-white" onClick={onClose}>×</button>
        </div>

        <div className="mb-4 grid grid-cols-2 rounded-md bg-slate-950 p-1">
          <button
            type="button"
            className={'rounded px-3 py-2 text-sm ' + (mode === 'login' ? 'bg-slate-800 text-white' : 'text-slate-400')}
            onClick={() => setMode('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={'rounded px-3 py-2 text-sm ' + (mode === 'register' ? 'bg-slate-800 text-white' : 'text-slate-400')}
            onClick={() => setMode('register')}
          >
            Sign up
          </button>
        </div>

        <form className="space-y-3" onSubmit={submit}>
          {mode === 'register' && (
            <input
              className="app-input"
              placeholder="Username"
              value={form.username}
              onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
            />
          )}
          <input
            className="app-input"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
          <input
            className="app-input"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
          />
          {message && <p className="text-sm text-slate-400">{message}</p>}
          <button className="primary-button w-full" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </section>
    </div>
  );
}

type NavItem = {
  to: string;
  label: string;
  icon: string;
};

const analyzeNav: NavItem[] = [
  { to: '/', label: 'File analysis', icon: 'file' },
  { to: '/url', label: 'URL analysis', icon: 'file' },
  { to: '/search', label: 'Search', icon: 'search' },
];

const accountNav: NavItem[] = [
  { to: '/history', label: 'History', icon: 'history' },
  { to: '/notifications', label: 'Notifications', icon: 'bell' },
  { to: '/llm', label: 'AI assistant', icon: 'brain' },
  { to: '/api-keys', label: 'API keys', icon: 'key' },
  { to: '/profile/security', label: 'Security', icon: 'shield' },
];

function SidebarLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ' +
        (isActive
          ? 'bg-slate-800 text-white'
          : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200')
      }
    >
      <NavIcon name={item.icon} />
      <span>{item.label}</span>
    </NavLink>
  );
}

export function AppShell() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setSearch(new URLSearchParams(location.search).get('q') ?? '');
    setMobileNavOpen(false);
  }, [location.pathname, location.search]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? '/search?q=' + encodeURIComponent(query) : '/search');
  }

  const sidebar = (
    <aside className="flex h-full w-60 flex-col border-r border-slate-800 bg-slate-950">
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
          Analyze
        </p>
        <nav className="space-y-1">
          {analyzeNav.map((item) => <SidebarLink key={item.to} item={item} />)}
        </nav>

        <p className="mt-7 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
          Account
        </p>
        <nav className="space-y-1">
          {accountNav.map((item) => <SidebarLink key={item.to} item={item} />)}
        </nav>

        {(auth.user?.role === 'MODERATOR' || auth.user?.role === 'ADMIN') && (
          <>
            <p className="mt-7 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              Operations
            </p>
            <nav className="space-y-1">
              <SidebarLink item={{ to: '/moderation', label: 'Moderation', icon: 'shield' }} />
              {auth.user?.role === 'ADMIN' && (
                <SidebarLink item={{ to: '/admin', label: 'Admin', icon: 'shield' }} />
              )}
            </nav>
          </>
        )}
      </div>

      <div className="border-t border-slate-800 px-4 py-4 text-xs text-slate-600">
        GO VIRUS · Security analysis platform
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-slate-800 bg-slate-900 px-3 sm:px-4">
        <button
          className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
          onClick={() => setMobileNavOpen((value) => !value)}
          aria-label="Toggle navigation"
        >
          <MenuIcon />
        </button>

        <button className="flex shrink-0 items-center gap-2" onClick={() => navigate('/')}>
          <BrandMark className="h-8 w-8" />
          <span className="hidden text-sm font-semibold tracking-wide text-slate-100 sm:block">
            GO VIRUS
          </span>
        </button>

        <form
          className="mx-auto flex h-9 max-w-2xl flex-1 items-center rounded-md border border-slate-700 bg-slate-950 px-3 text-slate-500 focus-within:border-slate-500"
          onSubmit={submitSearch}
        >
          <SearchIcon />
          <input
            className="w-full bg-transparent px-2 text-sm text-slate-200 outline-none placeholder:text-slate-600"
            placeholder="Search hash or artifact ID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </form>

        <div className="flex shrink-0 items-center gap-2">
          {auth.user ? (
            <>
              <button
                className="hidden rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 md:block"
                onClick={() => navigate('/history')}
              >
                {auth.user.username}
              </button>
              <button className="secondary-button" onClick={() => void auth.signOut()}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <button className="secondary-button" onClick={() => setAuthOpen(true)}>Sign in</button>
              <button className="primary-button" onClick={() => setAuthOpen(true)}>Create account</button>
            </>
          )}
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <div className="hidden lg:block">{sidebar}</div>

        {mobileNavOpen && (
          <div className="fixed inset-0 top-14 z-30 flex bg-black/40 lg:hidden" onClick={() => setMobileNavOpen(false)}>
            <div onClick={(event) => event.stopPropagation()}>{sidebar}</div>
          </div>
        )}

        <div className="min-w-0 flex-1 bg-slate-950">
          <Outlet />
        </div>
      </div>

      {authOpen && <AuthPanel onClose={() => setAuthOpen(false)} />}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

export function StatusNotice({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-2 w-2 rounded-full bg-amber-400" />
        <div>
          <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
          <div className="mt-1 text-sm leading-6 text-slate-500">{children}</div>
        </div>
      </div>
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
    <main className="app-page">
      <PageHeader title={title} description={description} />
      <StatusNotice title="This page is not connected to a backend endpoint yet.">
        {requirement ?? 'The route is part of the frontend structure and will be enabled when the corresponding API is implemented.'}
      </StatusNotice>
    </main>
  );
}
