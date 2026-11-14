import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { formatBytes, Icon, Spinner, timeAgo, VERDICT_STYLE, VerdictPill } from '../components';
import { ScanChamber, useScannerCapabilities } from '../scanner';
import type { AccountOverview, Verdict } from '../types';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function Stat({ label, value, hint, tone = 'text-white' }: { label: string; value: number | string; hint?: string; tone?: string }) {
  return (
    <div className="px-5 py-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={'display-tight mt-1.5 text-[30px] leading-none ' + tone}>{value}</p>
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function ActivityChart({ data }: { data: AccountOverview['activity'] }) {
  const max = Math.max(1, ...data.map((point) => point.count));
  const total = data.reduce((sum, point) => sum + point.count, 0);

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Scans in the last 30 days</p>
          <p className="mt-0.5 text-xs text-slate-500">{total} submitted</p>
        </div>
      </div>
      <div className="mt-5 flex h-36 items-end gap-[3px]" role="img" aria-label={total + ' scans in the last 30 days'}>
        {data.map((point) => (
          <div key={point.date} className="group relative flex h-full flex-1 items-end">
            <div
              className={'w-full rounded-t-[3px] transition-colors ' + (point.count ? 'bg-blue-500/70 group-hover:bg-beam' : 'bg-slate-800')}
              style={{ height: point.count ? Math.max(8, (point.count / max) * 100) + '%' : '3px' }}
            />
            <span className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 group-hover:block">
              {new Date(point.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: {point.count}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-slate-600">
        <span>30 days ago</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function VerdictMix({ verdicts }: { verdicts: Record<Verdict, number> }) {
  const order: Verdict[] = ['MALICIOUS', 'SUSPICIOUS', 'HARMLESS', 'UNKNOWN'];
  const colors: Record<Verdict, string> = {
    MALICIOUS: 'bg-rose-500',
    SUSPICIOUS: 'bg-amber-400',
    HARMLESS: 'bg-emerald-400',
    UNKNOWN: 'bg-slate-600',
  };
  const total = order.reduce((sum, key) => sum + verdicts[key], 0);

  return (
    <div>
      <p className="text-sm font-semibold text-white">Verdict mix</p>
      <p className="mt-0.5 text-xs text-slate-500">Latest verdict per artifact you submitted</p>
      <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-slate-800">
        {total > 0 &&
          order.map((key) =>
            verdicts[key] ? (
              <div key={key} className={colors[key]} style={{ width: (verdicts[key] / total) * 100 + '%' }} />
            ) : null,
          )}
      </div>
      <ul className="mt-5 space-y-2.5">
        {order.map((key) => (
          <li key={key} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2.5 text-slate-300">
              <span className={'h-2.5 w-2.5 rounded-sm ' + colors[key]} />
              {VERDICT_STYLE[key].label}
            </span>
            <span className="tabular-nums text-slate-400">
              {verdicts[key]}
              <span className="ml-2 inline-block w-10 text-right text-slate-600">
                {total ? Math.round((verdicts[key] / total) * 100) + '%' : '—'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function OverviewPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const capabilities = useScannerCapabilities();
  const [data, setData] = useState<AccountOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api.accountOverview(token).then(setData).catch((err) => setError(err instanceof Error ? err.message : 'Could not load your overview'));
  }, [token]);

  async function scan(file: File, options: { visibility: 'PUBLIC' | 'PRIVATE'; forceRescan: boolean }) {
    const result = await api.uploadFile(file, options, token);
    navigate('/app/artifact/' + result.artifact.id, {
      state: { reusedScan: result.reusedScan, submissionVisibility: result.submission.visibility },
    });
  }

  const threats = data ? data.stats.verdicts.MALICIOUS + data.stats.verdicts.SUSPICIOUS : 0;

  const checklist = data
    ? [
        {
          done: data.user.twoFactorEnabled,
          title: 'Turn on two-factor sign-in',
          body: 'Require a code from your authenticator app.',
          to: '/app/settings/security',
        },
        {
          done: data.stats.submissions > 0,
          title: 'Run your first scan',
          body: 'Drop a file in the scanner on this page.',
          to: '/app/scan',
        },
        {
          done: data.stats.activeApiKeys > 0,
          title: 'Create an API key',
          body: 'Automate scans from scripts and pipelines.',
          to: '/app/api-keys',
        },
        {
          done: data.stats.activeSessions <= 3,
          title: 'Review signed-in devices',
          body: data.stats.activeSessions + ' active session' + (data.stats.activeSessions === 1 ? '' : 's') + ' right now.',
          to: '/app/settings',
        },
      ]
    : [];
  const doneCount = checklist.filter((item) => item.done).length;

  return (
    <div className="app-page">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-400">{greeting()},</p>
          <h1 className="display text-[34px] text-white sm:text-[40px]">{user?.username}</h1>
        </div>
        <div className="flex gap-2">
          <Link to="/app/url" className="secondary-button">
            <Icon name="globe" className="h-4 w-4" /> Scan a URL
          </Link>
          <Link to="/app/history" className="secondary-button">
            <Icon name="clock" className="h-4 w-4" /> History
          </Link>
        </div>
      </div>

      {error && <div className="gv-inline-error mb-6">{error}</div>}

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-800 bg-slate-800 md:grid-cols-5 [&>*]:bg-slate-900 max-md:[&>*:last-child]:col-span-2">
        {data ? (
          <>
            <Stat label="Total scans" value={data.stats.submissions} />
            <Stat label="Files" value={data.stats.files} />
            <Stat label="URLs" value={data.stats.urls} />
            <Stat
              label="Threats found"
              value={threats}
              tone={threats ? 'text-rose-300' : 'text-white'}
              hint={threats ? 'Malicious or suspicious' : 'Nothing flagged yet'}
            />
            <Stat label="Unread alerts" value={data.stats.unreadNotifications} />
          </>
        ) : (
          <div className="col-span-full flex items-center gap-3 px-5 py-8 text-sm text-slate-400">
            <Spinner /> Loading your numbers
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div>
          <ScanChamber capabilities={capabilities} onScan={scan} compact showOptions allowPrivate />
        </div>

        <section className="surface p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Secure your account</p>
            <span className="text-xs text-slate-500">
              {doneCount} of {checklist.length || 4} done
            </span>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: (doneCount / (checklist.length || 4)) * 100 + '%' }} />
          </div>
          <ul className="mt-4 divide-y divide-slate-800">
            {checklist.map((item) => (
              <li key={item.title}>
                <Link to={item.to} className="group flex items-start gap-3 py-3">
                  <span
                    className={
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ' +
                      (item.done ? 'border-emerald-400 bg-emerald-400 text-slate-950' : 'border-slate-600')
                    }
                  >
                    {item.done && <Icon name="check" className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={'block text-sm font-medium ' + (item.done ? 'text-slate-500 line-through' : 'text-slate-100 group-hover:text-white')}>
                      {item.title}
                    </span>
                    <span className="block text-xs leading-5 text-slate-500">{item.body}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {data && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <section className="surface p-5">
            <ActivityChart data={data.activity} />
          </section>
          <section className="surface p-5">
            <VerdictMix verdicts={data.stats.verdicts} />
          </section>
        </div>
      )}

      {data && (
        <section className="surface mt-6 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-sm font-semibold text-white">Recent scans</p>
            <Link to="/app/history" className="text-link">View all</Link>
          </div>
          {data.recent.length ? (
            <div className="overflow-x-auto">
              <table className="data-table min-w-[640px]">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Visibility</th>
                    <th>Verdict</th>
                    <th className="text-right">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((item) => (
                    <tr key={item.id} className="cursor-pointer" onClick={() => navigate('/app/artifact/' + item.artifactId)}>
                      <td className="max-w-[320px]">
                        <Link
                          to={'/app/artifact/' + item.artifactId}
                          className="flex items-center gap-3 font-medium text-slate-100 hover:text-white"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-slate-400">
                            <Icon name={item.artifactType === 'URL' ? 'globe' : 'file'} className="h-4 w-4" />
                          </span>
                          <span className="truncate">{item.displayName}</span>
                        </Link>
                      </td>
                      <td className="text-slate-400">
                        {item.artifactType === 'URL' ? 'URL' : item.size ? formatBytes(Number(item.size)) : 'File'}
                      </td>
                      <td className="text-slate-400">{item.visibility === 'PRIVATE' ? 'Private' : 'Public'}</td>
                      <td>
                        <VerdictPill
                          verdict={item.latestScan?.verdict}
                          pending={item.latestScan?.status === 'RUNNING' || item.latestScan?.status === 'QUEUED'}
                        />
                      </td>
                      <td className="text-right text-slate-400">{timeAgo(item.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state border-t border-slate-800">
              <p className="font-semibold text-white">No scans yet</p>
              <p className="mt-1 text-sm text-slate-400">Drop a file into the scanner above to get your first report.</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
