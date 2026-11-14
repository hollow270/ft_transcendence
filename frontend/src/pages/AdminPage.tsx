import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { PageHeader, StatusNotice } from '../components';
import type {
  AdminActivityPoint,
  AdminOverview,
} from '../types';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail?: string;
}) {
  return (
    <section className="surface p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-100">
        {value.toLocaleString()}
      </p>
      {detail && (
        <p className="mt-1 text-xs text-slate-600">
          {detail}
        </p>
      )}
    </section>
  );
}

export default function AdminPage() {
  const { token, user } = useAuth();
  const [overview, setOverview] =
    useState<AdminOverview | null>(null);
  const [activity, setActivity] =
    useState<AdminActivityPoint[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] =
    useState(Boolean(token));
  const [error, setError] =
    useState<string | null>(null);
  const [exporting, setExporting] =
    useState(false);

  async function load() {
    if (!token || user?.role !== 'ADMIN') {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [overviewData, activityData] =
        await Promise.all([
          api.adminOverview(token),
          api.adminActivity(days, token),
        ]);

      setOverview(overviewData);
      setActivity(activityData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load admin analytics',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token, user?.role, days]);

  const maxActivity = useMemo(
    () =>
      Math.max(
        1,
        ...activity.map((item) =>
          Math.max(
            item.users,
            item.files + item.urls,
            item.scans,
            item.apiRequests,
          ),
        ),
      ),
    [activity],
  );

  async function exportCsv() {
    if (!token) return;

    setExporting(true);
    setError(null);

    try {
      const blob =
        await api.adminExportCsv(token);
      const url =
        URL.createObjectURL(blob);
      const anchor =
        document.createElement('a');

      anchor.href = url;
      anchor.download =
        'go-virus-admin-metrics.csv';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not export admin metrics',
      );
    } finally {
      setExporting(false);
    }
  }

  if (!user || user.role !== 'ADMIN') {
    return (
      <main className="app-page">
        <PageHeader
          title="Admin"
          description="Platform administration and operational analytics."
        />
        <StatusNotice title="Access restricted">
          Admin role is required to view this page.
        </StatusNotice>
      </main>
    );
  }

  return (
    <main className="app-page">
      <PageHeader
        title="Admin"
        description="Operational metrics, platform activity, API usage and security audit events."
        actions={
          <button
            className="secondary-button"
            disabled={
              exporting || !overview
            }
            onClick={() =>
              void exportCsv()
            }
          >
            {exporting
              ? 'Exporting…'
              : 'Export CSV'}
          </button>
        }
      />

      {error && (
        <div className="mb-5 rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && !overview ? (
        <section className="surface p-8 text-sm text-slate-500">
          Loading platform analytics…
        </section>
      ) : overview ? (
        <div className="space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold text-slate-300">
                Platform
              </h2>
              <p className="text-xs text-slate-600">
                Generated {formatDate(overview.generatedAt)}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Registered users"
                value={overview.users.registered}
                detail={
                  overview.users.active +
                  ' active accounts'
                }
              />
              <MetricCard
                label="Online now"
                value={overview.users.onlineNow}
                detail="Active session seen in the last 5 minutes"
              />
              <MetricCard
                label="File submissions"
                value={overview.submissions.files}
              />
              <MetricCard
                label="URL submissions"
                value={overview.submissions.urls}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-300">
              Scanning
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Total scans"
                value={overview.scans.total}
                detail={
                  overview.scans.completed +
                  ' completed'
                }
              />
              <MetricCard
                label="Running"
                value={overview.scans.running}
              />
              <MetricCard
                label="Failed"
                value={overview.scans.failed}
              />
              <MetricCard
                label="Malicious verdicts"
                value={
                  overview.scans.verdicts.MALICIOUS
                }
                detail={
                  overview.scans.verdicts.SUSPICIOUS +
                  ' suspicious'
                }
              />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-300">
              Services
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="API requests"
                value={overview.api.requests}
                detail={
                  overview.api.requests24h +
                  ' in the last 24h'
                }
              />
              <MetricCard
                label="API errors 24h"
                value={overview.api.errors24h}
                detail={
                  overview.api.activeKeys +
                  ' active API keys'
                }
              />
              <MetricCard
                label="Comments"
                value={overview.community.comments}
                detail={
                  overview.community.openReports +
                  ' open moderation reports'
                }
              />
              <MetricCard
                label="LLM requests"
                value={overview.llm.requests}
                detail={
                  overview.llm.requests24h +
                  ' in the last 24h'
                }
              />
            </div>
          </section>

          <section className="surface">
            <div className="surface-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-200">
                  Activity
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  New users, submissions, scans and API requests by UTC day
                </p>
              </div>

              <select
                className="gv-compact-select"
                value={days}
                onChange={(event) =>
                  setDays(
                    Number(event.target.value),
                  )
                }
              >
                <option value={7}>
                  Last 7 days
                </option>
                <option value={14}>
                  Last 14 days
                </option>
                <option value={30}>
                  Last 30 days
                </option>
              </select>
            </div>

            <div className="surface-body space-y-3">
              {activity.map((point) => {
                const submissions =
                  point.files + point.urls;
                const width =
                  (Math.max(
                    point.scans,
                    submissions,
                    point.apiRequests,
                    point.users,
                  ) /
                    maxActivity) *
                  100;

                return (
                  <div
                    key={point.date}
                    className="grid gap-2 border-b border-slate-800 pb-3 last:border-b-0 sm:grid-cols-[110px_minmax(120px,1fr)_auto]"
                  >
                    <span className="text-xs text-slate-500">
                      {point.date}
                    </span>

                    <div className="flex items-center">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900">
                        <div
                          className="h-full rounded-full bg-cyan-700"
                          style={{
                            width:
                              Math.max(
                                3,
                                width,
                              ) + '%',
                          }}
                        />
                      </div>
                    </div>

                    <span className="text-xs text-slate-500">
                      {point.scans} scans ·{' '}
                      {submissions} submissions ·{' '}
                      {point.apiRequests} API
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="surface overflow-hidden">
              <div className="surface-header">
                <h2 className="text-sm font-semibold text-slate-200">
                  Recent users
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recentUsers.map(
                      (entry) => (
                        <tr key={entry.id}>
                          <td>
                            <p className="text-slate-300">
                              {entry.username}
                            </p>
                            <p className="text-xs text-slate-600">
                              {entry.email}
                            </p>
                          </td>
                          <td>{entry.role}</td>
                          <td>{entry.status}</td>
                          <td className="whitespace-nowrap">
                            {formatDate(
                              entry.createdAt,
                            )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="surface overflow-hidden">
              <div className="surface-header">
                <h2 className="text-sm font-semibold text-slate-200">
                  Security audit
                </h2>
              </div>

              {overview.recentAudit.length ? (
                <div className="divide-y divide-slate-800">
                  {overview.recentAudit.map(
                    (entry) => (
                      <article
                        key={entry.id}
                        className="px-5 py-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <code className="text-xs text-cyan-300">
                            {entry.action}
                          </code>
                          <span className="text-xs text-slate-600">
                            {formatDate(
                              entry.createdAt,
                            )}
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-slate-500">
                          Actor:{' '}
                          {entry.actor?.username ??
                            'system'}
                          {entry.targetType
                            ? ' · ' +
                              entry.targetType
                            : ''}
                          {entry.targetId
                            ? ' · ' +
                              entry.targetId
                            : ''}
                        </p>
                      </article>
                    ),
                  )}
                </div>
              ) : (
                <div className="empty-state">
                  <p className="text-sm text-slate-500">
                    No audit events yet.
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </main>
  );
}
