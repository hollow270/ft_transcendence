import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { api } from './api';
import { useAuth } from './auth';
import type { User } from './types';

/* ------------------------------------------------------------------ */
/* Brand                                                              */
/* ------------------------------------------------------------------ */

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" role="img" aria-label="GO VIRUS">
      <rect width="40" height="40" rx="11" fill="#141A2D" />
      <rect x=".5" y=".5" width="39" height="39" rx="10.5" fill="none" stroke="#2C3554" />
      <path
        d="M9 13h5.6l5.4 8.4L26 13h5L20 30z"
        fill="none"
        stroke="#6BE4FF"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path d="M12 9.5h16" stroke="#5C76FF" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={'display-tight whitespace-nowrap text-[17px] text-white ' + className}>
      go virus
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Icons                                                              */
/* ------------------------------------------------------------------ */

const ICONS = {
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  file: 'M6 3h8l4 4v14H6zM14 3v5h5',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 4 6 4 9s-1 6-4 9c-3-3-4-6-4-9s1-6 4-9',
  search: 'M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM16 16l4 4',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  spark: 'M12 3c.7 4.2 2.6 6.1 7 7-4.4.8-6.3 2.7-7 7-.7-4.3-2.6-6.2-7-7 4.4-.9 6.3-2.8 7-7z',
  bell: 'M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  key: 'M14.5 4a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM10.6 13.4 4 20M7 17l2 2M5 19l2 2',
  user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4.5 21c.8-4.3 3.2-6.5 7.5-6.5s6.7 2.2 7.5 6.5',
  shield: 'M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6zM9 12l2 2 4-4',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  users: 'M9 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2.5 20c.6-3.6 2.8-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.5a3.3 3.3 0 0 1 0 6.4M18 14.6c2.2.5 3.3 2.2 3.6 5.4',
  menu: 'M4 6h16M4 12h16M4 18h16',
  sidebar: 'M4 4h16v16H4zM9 4v16',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  plus: 'M12 5v14M5 12h14',
  upload: 'M12 16V4M7 9l5-5 5 5M4 15v5h16v-5',
  lock: 'M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6 6 18',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  monitor: 'M3 4h18v12H3zM8 20h8M12 16v4',
  alert: 'M12 3 2 20h20zM12 9v5M12 17v.5',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  className = 'h-[18px] w-[18px]',
  strokeWidth = 1.8,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Small shared bits                                                  */
/* ------------------------------------------------------------------ */

const AVATAR_TINTS = ['#6BE4FF', '#A8B8FF', '#34D399', '#FBBF24', '#F9A8D4', '#C4B5FD'];

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const tint = AVATAR_TINTS[hash % AVATAR_TINTS.length];

  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: tint, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export const VERDICT_STYLE: Record<string, { label: string; className: string; dot: string }> = {
  HARMLESS: {
    label: 'Clean',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    dot: 'bg-emerald-400',
  },
  SUSPICIOUS: {
    label: 'Suspicious',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    dot: 'bg-amber-400',
  },
  MALICIOUS: {
    label: 'Malicious',
    className: 'border-rose-500/35 bg-rose-500/10 text-rose-300',
    dot: 'bg-rose-500',
  },
  UNKNOWN: {
    label: 'Inconclusive',
    className: 'border-slate-700 bg-slate-800/50 text-slate-300',
    dot: 'bg-slate-500',
  },
};

export function VerdictPill({ verdict, pending = false }: { verdict?: string | null; pending?: boolean }) {
  if (pending) {
    return (
      <span className="status-badge gap-1.5 border-blue-500/30 bg-blue-500/10 text-blue-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
        Scanning
      </span>
    );
  }
  const style = VERDICT_STYLE[verdict ?? 'UNKNOWN'] ?? VERDICT_STYLE.UNKNOWN;
  return (
    <span className={'status-badge gap-1.5 ' + style.className}>
      <span className={'h-1.5 w-1.5 rounded-full ' + style.dot} />
      {style.label}
    </span>
  );
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function timeAgo(value?: string | null) {
  if (!value) return '—';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes + ' min ago';
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours + ' h ago';
  const days = Math.round(hours / 24);
  if (days < 30) return days + ' d ago';
  return new Date(value).toLocaleDateString();
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={'animate-spin ' + className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Route guard                                                        */
/* ------------------------------------------------------------------ */

export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink text-slate-400">
      <div className="flex items-center gap-3 text-sm">
        <Spinner />
        Loading your workspace
      </div>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;

  if (!user) {
    const next = location.pathname + location.search;
    return <Navigate to={'/login?next=' + encodeURIComponent(next)} replace />;
  }

  return <>{children}</>;
}

export function RequireRole({
  roles,
  children,
}: {
  roles: Array<User['role']>;
  children: ReactNode;
}) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return (
      <FeaturePending
        title="Restricted area"
        description="Your role does not include access to this page."
        requirement="Ask an administrator if you need access."
      />
    );
  }
  return <>{children}</>;
}

/* ------------------------------------------------------------------ */
/* App shell                                                          */
/* ------------------------------------------------------------------ */

type NavItem = { to: string; label: string; icon: IconName; end?: boolean };

function navGroups(user: User | null): Array<{ title: string; items: NavItem[] }> {
  const groups: Array<{ title: string; items: NavItem[] }> = [
    {
      title: 'Workspace',
      items: [
        { to: '/app', label: 'Overview', icon: 'grid', end: true },
        { to: '/app/scan', label: 'Scan a file', icon: 'file' },
        { to: '/app/url', label: 'Scan a URL', icon: 'globe' },
        { to: '/app/search', label: 'Search', icon: 'search' },
        { to: '/app/history', label: 'History', icon: 'clock' },
      ],
    },
    {
      title: 'Insights',
      items: [
        { to: '/app/llm', label: 'AI assistant', icon: 'spark' },
        { to: '/app/notifications', label: 'Notifications', icon: 'bell' },
      ],
    },
    {
      title: 'Developers',
      items: [{ to: '/app/api-keys', label: 'API keys', icon: 'key' }],
    },
    {
      title: 'Account',
      items: [
        { to: '/app/settings', label: 'Profile & sessions', icon: 'user', end: true },
        { to: '/app/settings/security', label: 'Two-factor auth', icon: 'shield' },
      ],
    },
  ];

  const staff: NavItem[] = [];
  if (user?.role === 'MODERATOR' || user?.role === 'ADMIN') {
    staff.push({ to: '/app/moderation', label: 'Moderation', icon: 'flag' });
  }
  if (user?.role === 'ADMIN') {
    staff.push({ to: '/app/admin', label: 'Analytics', icon: 'chart', end: true });
    staff.push({ to: '/app/admin/users', label: 'Users', icon: 'users' });
  }
  if (staff.length) groups.push({ title: 'Staff', items: staff });

  return groups;
}

function Sidebar({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { user } = useAuth();

  return (
    <aside className="shell-sidebar">
      <Link
        to="/app"
        onClick={onNavigate}
        className={'flex h-16 shrink-0 items-center gap-3 border-b hairline ' + (collapsed ? 'justify-center' : 'px-5')}
      >
        <BrandMark className="h-8 w-8 shrink-0" />
        {!collapsed && <Wordmark />}
      </Link>

      <nav className="flex-1 pb-6">
        {navGroups(user).map((group) => (
          <div key={group.title} className="shell-nav-group">
            <div className="shell-nav-title">{group.title}</div>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) => 'shell-link ' + (isActive ? 'shell-link-active' : '')}
                >
                  <Icon name={item.icon} />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {user && !collapsed && (
        <div className="m-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="flex items-center gap-3">
            <Avatar name={user.username} size={34} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{user.username}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
          </div>
          {user.role !== 'USER' && (
            <p className="mt-2.5 inline-flex rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-medium capitalize text-blue-300">
              {user.role.toLowerCase()}
            </p>
          )}
        </div>
      )}
    </aside>
  );
}

function AccountMenu() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  if (!auth.user) return null;

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex items-center gap-2 rounded-full p-0.5 ring-blue-500/40 transition hover:ring-4"
        onClick={() => setOpen((value) => !value)}
        aria-label="Account menu"
        aria-expanded={open}
      >
        <Avatar name={auth.user.username} size={34} />
      </button>

      {open && (
        <div className="menu-pop">
          <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3.5">
            <Avatar name={auth.user.username} size={38} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{auth.user.username}</p>
              <p className="truncate text-xs text-slate-500">{auth.user.email}</p>
            </div>
          </div>
          <div className="p-1.5">
            <button className="menu-item" onClick={() => go('/app/users/' + auth.user!.id + '/community')}>
              <Icon name="user" /> Public profile
            </button>
            <button className="menu-item" onClick={() => go('/app/settings')}>
              <Icon name="monitor" /> Profile & sessions
            </button>
            <button className="menu-item" onClick={() => go('/app/settings/security')}>
              <Icon name="shield" /> Two-factor auth
            </button>
            <button className="menu-item" onClick={() => go('/app/api-keys')}>
              <Icon name="key" /> API keys
            </button>
            <button className="menu-item" onClick={() => go('/')}>
              <Icon name="external" /> Product site
            </button>
          </div>
          <div className="border-t border-slate-800 p-1.5">
            <button
              className="menu-item text-rose-300 hover:text-rose-200"
              onClick={async () => {
                setOpen(false);
                await auth.signOut();
                navigate('/');
              }}
            >
              <Icon name="logout" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    setSearch(new URLSearchParams(location.search).get('q') ?? '');
    setDrawer(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!token) return;
    api
      .notifications(token)
      .then((items) => setUnread(items.filter((item) => !item.readAt).length))
      .catch(() => setUnread(0));
  }, [token, location.pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === '/' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? '/app/search?q=' + encodeURIComponent(query) : '/app/search');
  }

  return (
    <div className={'shell ' + (collapsed ? 'shell-collapsed' : '')}>
      <Sidebar collapsed={collapsed} />

      {drawer && (
        <div
          className="shell-drawer fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setDrawer(false)}
        >
          <div onClick={(event) => event.stopPropagation()}>
            <Sidebar collapsed={false} onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="min-w-0">
        <header className="shell-topbar">
          <button
            className="icon-button"
            aria-label="Toggle navigation"
            onClick={() => {
              if (window.innerWidth < 1024) setDrawer(true);
              else setCollapsed((value) => !value);
            }}
          >
            <Icon name={collapsed ? 'menu' : 'sidebar'} />
          </button>

          <form className="shell-search" onSubmit={submitSearch} role="search">
            <Icon name="search" className="h-4 w-4" />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search hashes, file names, domains"
              aria-label="Search"
            />
            <kbd className="hidden sm:inline">/</kbd>
          </form>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <button className="primary-button hidden h-9 py-0 sm:inline-flex" onClick={() => navigate('/app/scan')}>
              <Icon name="plus" className="h-4 w-4" strokeWidth={2.2} />
              New scan
            </button>
            <button className="icon-button" onClick={() => navigate('/app/notifications')} aria-label="Notifications">
              <Icon name="bell" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 min-w-[16px] rounded-full bg-blue-500 px-1 text-center text-[10px] font-bold leading-4 text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
            <AccountMenu />
          </div>
        </header>

        <div className="min-h-[calc(100vh-64px)]">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page scaffolding                                                   */
/* ------------------------------------------------------------------ */

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
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="display-tight text-[28px] leading-tight text-white sm:text-[32px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] leading-6 text-slate-400">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

export function StatusNotice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-amber-400">
          <Icon name="alert" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          <div className="mt-1 text-sm leading-6 text-slate-400">{children}</div>
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
    <div className="app-page">
      <PageHeader title={title} description={description} />
      <StatusNotice title="Nothing to show here">
        {requirement ?? 'This page is not available yet.'}{' '}
        <Link className="text-link" to="/app">
          Back to overview
        </Link>
      </StatusNotice>
    </div>
  );
}
