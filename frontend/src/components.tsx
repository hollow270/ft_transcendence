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
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="52%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#84cc16" />
        </linearGradient>
      </defs>
      <circle cx="80" cy="80" r="59" fill="none" stroke="#1f4268" strokeWidth="6" />
      <circle cx="80" cy="80" r="48" fill="none" stroke="#154d68" strokeWidth="2" opacity=".8" />
      <path
        d="M36 56 L58 56 L80 90 L105 56 L126 56 L80 126 Z"
        fill="none"
        stroke="url(#brand-a)"
        strokeWidth="10"
        strokeLinejoin="round"
      />
      <path
        d="M48 42 L80 82 L122 31"
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
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21c.8-4.3 3.2-6.5 7.5-6.5s6.7 2.2 7.5 6.5" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 4 6 4 9s-1 6-4 9c-3-3-4-6-4-9s1-6 4-9" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19 13.5v-3l-2.1-.6a7 7 0 0 0-.6-1.5l1.1-1.9-2.1-2.1-1.9 1.1a7 7 0 0 0-1.5-.6L10.5 3h-3L7 5.1a7 7 0 0 0-1.5.6L3.6 4.6 1.5 6.7l1.1 1.9A7 7 0 0 0 2 10.1L0 10.5v3l2 .4a7 7 0 0 0 .6 1.5l-1.1 1.9 2.1 2.1 1.9-1.1a7 7 0 0 0 1.5.6l.5 2.1h3l.5-2.1a7 7 0 0 0 1.5-.6l1.9 1.1 2.1-2.1-1.1-1.9a7 7 0 0 0 .6-1.5z" transform="translate(2 0) scale(.83)" />
    </svg>
  );
}

function AuthPanel({ onClose }: { onClose: () => void }) {
  const {
    mode,
    setMode,
    form,
    setForm,
    busy,
    message,
    twoFactorRequired,
    submit,
  } = useAuthForm();
  const { user } = useAuth();

  useEffect(() => {
    if (user) onClose();
  }, [user, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/55 p-4 pt-20" onClick={onClose}>
      <section
        className="w-full max-w-sm rounded-xl border border-[#2c4770] bg-[#0d1728] p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
          <button className="text-slate-400 hover:text-white" onClick={onClose}>×</button>
        </div>

        <div className="mb-4 grid grid-cols-2 rounded-lg bg-[#08111e] p-1">
          <button
            type="button"
            className={'rounded-md px-3 py-2 text-sm ' + (mode === 'login' ? 'bg-[#17253c] text-white' : 'text-slate-400')}
            onClick={() => setMode('login')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={'rounded-md px-3 py-2 text-sm ' + (mode === 'register' ? 'bg-[#17253c] text-white' : 'text-slate-400')}
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
          {mode === 'login' && twoFactorRequired && (
            <input
              className="app-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit authenticator code"
              value={form.totpCode}
              maxLength={6}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  totpCode: event.target.value.replace(/\D/g, '').slice(0, 6),
                }))
              }
            />
          )}
          {message && <p className="text-sm text-slate-400">{message}</p>}
          <button className="primary-button w-full" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </section>
    </div>
  );
}

function Sidebar({
  collapsed,
  onLinkClick,
  onBrandClick,
}: {
  collapsed: boolean;
  onLinkClick?: () => void;
  onBrandClick?: () => void;
}) {
  return (
    <aside className={'gv-sidebar ' + (collapsed ? 'gv-sidebar-collapsed' : '')}>
      <button className="gv-brand" onClick={onBrandClick}>
        <BrandMark className="h-12 w-12 shrink-0" />
        {!collapsed && (
          <span className="whitespace-nowrap text-xl font-bold tracking-tight">
            <span className="text-white">go </span>
            <span className="text-cyan-400">virus</span>
          </span>
        )}
      </button>

      <nav className="mt-9 space-y-3">
        <NavLink
          to="/"
          end
          onClick={onLinkClick}
          className={({ isActive }) =>
            'gv-side-link ' + (isActive ? 'gv-side-link-active' : '')
          }
          title="File"
        >
          <FileIcon />
          {!collapsed && <span>File</span>}
        </NavLink>

        <NavLink
          to="/url"
          onClick={onLinkClick}
          className={({ isActive }) =>
            'gv-side-link ' + (isActive ? 'gv-side-link-active' : '')
          }
          title="URL"
        >
          <GlobeIcon />
          {!collapsed && <span>URL</span>}
        </NavLink>

      </nav>
    </aside>
  );
}

export function AppShell() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setSearch(new URLSearchParams(location.search).get('q') ?? '');
    setMobileNavOpen(false);
    setAccountOpen(false);
  }, [location.pathname, location.search]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? '/search?q=' + encodeURIComponent(query) : '/search');
  }

  function handleUserClick() {
    if (auth.user) {
      setAccountOpen((value) => !value);
      return;
    }
    setAuthOpen(true);
  }

  async function handleSignOut() {
    setAccountOpen(false);
    await auth.signOut();
    navigate('/');
  }

  return (
    <div className="gv-app">
      <div className="hidden lg:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          onBrandClick={() => navigate('/')}
        />
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex bg-black/60 lg:hidden" onClick={() => setMobileNavOpen(false)}>
          <div onClick={(event) => event.stopPropagation()}>
            <Sidebar
              collapsed={false}
              onLinkClick={() => setMobileNavOpen(false)}
              onBrandClick={() => {
                setMobileNavOpen(false);
                navigate('/');
              }}
            />
          </div>
        </div>
      )}

      <section className="gv-main-shell">
        <header className="gv-topbar">
          <button
            className="gv-icon-button"
            onClick={() => {
              if (window.innerWidth < 1024) {
                setMobileNavOpen(true);
              } else {
                setSidebarCollapsed((value) => !value);
              }
            }}
            aria-label="Toggle navigation"
          >
            <MenuIcon />
          </button>

          <form className="gv-search" onSubmit={submitSearch}>
            <SearchIcon />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search for files, hashes, domains..."
              aria-label="Search"
            />
          </form>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button
              className="gv-icon-button relative"
              onClick={() => navigate('/notifications')}
              aria-label="Notifications"
            >
              <BellIcon />
              {auth.user && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-cyan-400" />
              )}
            </button>

            <div className="relative">
              <button
                className="gv-profile-button"
                onClick={handleUserClick}
                aria-label={auth.user ? 'Account' : 'Sign in'}
                title={auth.user?.username ?? 'Sign in'}
              >
                <UserIcon />
              </button>

              {auth.user && accountOpen && (
                <div className="absolute right-0 top-14 z-50 w-64 overflow-hidden rounded-xl border border-[#2c4770] bg-[#0d1728] shadow-2xl">
                  <div className="border-b border-[#203754] px-4 py-3">
                    <p className="truncate text-sm font-semibold text-white">
                      {auth.user.username}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {auth.user.email}
                    </p>
                  </div>

                  <div className="p-2">
                    <button
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-[#17253c] hover:text-white"
                      onClick={() => {
                        setAccountOpen(false);
                        navigate('/history');
                      }}
                    >
                      History
                    </button>

                    <button
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-[#17253c] hover:text-white"
                      onClick={() => {
                        setAccountOpen(false);
                        navigate('/users/' + auth.user!.id + '/community');
                      }}
                    >
                      Community
                    </button>

                    <button
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-[#17253c] hover:text-white"
                      onClick={() => {
                        setAccountOpen(false);
                        navigate('/profile/security');
                      }}
                    >
                      Settings
                    </button>
                  </div>

                  <div className="border-t border-[#203754] p-2">
                    <button
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-red-300 hover:bg-red-950/30 hover:text-red-200"
                      onClick={() => void handleSignOut()}
                    >
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="gv-content">
          <Outlet />
        </div>
      </section>

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
