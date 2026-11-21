import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { io } from 'socket.io-client';
import { api } from '../api';
import { useAuth } from '../auth';
import {
  PageHeader,
  StatusNotice,
} from '../components';
import type {
  AdminActivityPoint,
  AdminOverview,
} from '../types';

type RangeMode =
  | 'TODAY'
  | '7D'
  | '30D'
  | 'CUSTOM';

type SeriesKey =
  | 'users'
  | 'submissions'
  | 'scans'
  | 'apiRequests';

function formatDate(
  value?: string | null,
) {
  if (!value) return '—';
  return new Date(
    value,
  ).toLocaleString();
}

function utcDateString(
  date: Date,
) {
  return date
    .toISOString()
    .slice(0, 10);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(
    date.getUTCDate() - days,
  );
  return utcDateString(date);
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

function ActivityChart({
  activity,
}: {
  activity: AdminActivityPoint[];
}) {
  const [visible, setVisible] =
    useState<
      Record<SeriesKey, boolean>
    >({
      users: true,
      submissions: true,
      scans: true,
      apiRequests: true,
    });

  const width = 860;
  const height = 250;
  const left = 42;
  const right = 18;
  const top = 20;
  const bottom = 38;
  const plotWidth =
    width - left - right;
  const plotHeight =
    height - top - bottom;

  const valuesFor = (
    point: AdminActivityPoint,
    key: SeriesKey,
  ) => {
    if (key === 'submissions') {
      return point.files + point.urls;
    }

    return point[key];
  };

  const maxValue = Math.max(
    1,
    ...activity.flatMap((point) =>
      (
        Object.keys(
          visible,
        ) as SeriesKey[]
      )
        .filter((key) => visible[key])
        .map((key) =>
          valuesFor(point, key),
        ),
    ),
  );

  const xFor = (index: number) =>
    activity.length <= 1
      ? left + plotWidth / 2
      : left +
        (index /
          (activity.length - 1)) *
          plotWidth;

  const yFor = (value: number) =>
    top +
    plotHeight -
    (value / maxValue) *
      plotHeight;

  const series: Array<{
    key: SeriesKey;
    label: string;
    className: string;
  }> = [
    {
      key: 'users',
      label: 'New users',
      className:
        'text-violet-400',
    },
    {
      key: 'submissions',
      label: 'Submissions',
      className:
        'text-cyan-400',
    },
    {
      key: 'scans',
      label: 'Scans',
      className:
        'text-emerald-400',
    },
    {
      key: 'apiRequests',
      label: 'API requests',
      className:
        'text-amber-400',
    },
  ];

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap gap-2"
        aria-label="Chart series"
      >
        {series.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={
              visible[item.key]
            }
            className={
              'rounded-md border px-3 py-1.5 text-xs transition ' +
              (visible[item.key]
                ? 'border-slate-600 bg-slate-800 text-slate-200'
                : 'border-slate-800 bg-slate-950 text-slate-600')
            }
            onClick={() =>
              setVisible(
                (current) => ({
                  ...current,
                  [item.key]:
                    !current[
                      item.key
                    ],
                }),
              )
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={
            '0 0 ' +
            width +
            ' ' +
            height
          }
          className="min-w-[620px] w-full"
          role="img"
          aria-label="GO VIRUS daily analytics chart"
        >
          {[0, 0.25, 0.5, 0.75, 1].map(
            (ratio) => {
              const y =
                top +
                plotHeight -
                plotHeight * ratio;
              return (
                <g key={ratio}>
                  <line
                    x1={left}
                    x2={
                      width - right
                    }
                    y1={y}
                    y2={y}
                    className="stroke-slate-800"
                    strokeWidth="1"
                  />
                  <text
                    x={left - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-slate-600 text-[10px]"
                  >
                    {Math.round(
                      maxValue *
                        ratio,
                    )}
                  </text>
                </g>
              );
            },
          )}

          {series.map((item) => {
            if (!visible[item.key]) {
              return null;
            }

            const points =
              activity
                .map(
                  (
                    point,
                    index,
                  ) =>
                    xFor(index) +
                    ',' +
                    yFor(
                      valuesFor(
                        point,
                        item.key,
                      ),
                    ),
                )
                .join(' ');

            return (
              <g
                key={item.key}
                className={
                  item.className
                }
              >
                <polyline
                  points={points}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {activity.map(
                  (
                    point,
                    index,
                  ) => (
                    <circle
                      key={
                        point.date
                      }
                      cx={xFor(
                        index,
                      )}
                      cy={yFor(
                        valuesFor(
                          point,
                          item.key,
                        ),
                      )}
                      r="3.5"
                      fill="currentColor"
                    >
                      <title>
                        {point.date +
                          ' · ' +
                          item.label +
                          ': ' +
                          valuesFor(
                            point,
                            item.key,
                          )}
                      </title>
                    </circle>
                  ),
                )}
              </g>
            );
          })}

          {activity.length > 0 && (
            <>
              <text
                x={left}
                y={height - 10}
                className="fill-slate-600 text-[10px]"
              >
                {
                  activity[0]
                    .date
                }
              </text>
              <text
                x={width - right}
                y={height - 10}
                textAnchor="end"
                className="fill-slate-600 text-[10px]"
              >
                {
                  activity[
                    activity.length -
                      1
                  ].date
                }
              </text>
            </>
          )}
        </svg>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { token, user } =
    useAuth();
  const [overview, setOverview] =
    useState<AdminOverview | null>(
      null,
    );
  const [activity, setActivity] =
    useState<
      AdminActivityPoint[]
    >([]);
  const [rangeMode, setRangeMode] =
    useState<RangeMode>('7D');
  const [customFrom, setCustomFrom] =
    useState(daysAgo(6));
  const [customTo, setCustomTo] =
    useState(daysAgo(0));
  const [loading, setLoading] =
    useState(Boolean(token));
  const [error, setError] =
    useState<string | null>(null);
  const [
    exportingFormat,
    setExportingFormat,
  ] = useState<
    'CSV' | 'PDF' | null
  >(null);
  const [
    lastLiveUpdate,
    setLastLiveUpdate,
  ] = useState<string | null>(
    null,
  );

  const range = useMemo(() => {
    if (
      rangeMode === 'CUSTOM'
    ) {
      return {
        activity: {
          from: customFrom,
          to: customTo,
        },
        export: {
          from: customFrom,
          to: customTo,
        },
      };
    }

    const days =
      rangeMode === 'TODAY'
        ? 1
        : rangeMode === '30D'
          ? 30
          : 7;

    return {
      activity: {
        days,
      },
      export: {
        from: daysAgo(
          days - 1,
        ),
        to: daysAgo(0),
      },
    };
  }, [
    rangeMode,
    customFrom,
    customTo,
  ]);

  async function load(
    silent = false,
  ) {
    if (
      !token ||
      user?.role !== 'ADMIN'
    ) {
      return;
    }

    if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const [
        overviewData,
        activityData,
      ] = await Promise.all([
        api.adminOverview(token),
        api.adminActivity(
          range.activity,
          token,
        ),
      ]);

      setOverview(
        overviewData,
      );
      setActivity(
        activityData,
      );

      if (silent) {
        setLastLiveUpdate(
          new Date().toISOString(),
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load admin analytics',
      );
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void load();
  }, [
    token,
    user?.role,
    rangeMode,
    customFrom,
    customTo,
  ]);

  useEffect(() => {
    if (
      !token ||
      user?.role !== 'ADMIN'
    ) {
      return;
    }

    const socket = io(
      window.location.origin,
      {
        path: '/socket.io',
        auth: { token },
        transports: [
          'websocket',
          'polling',
        ],
      },
    );

    socket.on(
      'admin:metrics',
      () => {
        void load(true);
      },
    );

    return () => {
      socket.disconnect();
    };
  }, [
    token,
    user?.role,
    rangeMode,
    customFrom,
    customTo,
  ]);

  async function exportData(
    format: 'CSV' | 'PDF',
  ) {
    if (!token) return;

    setExportingFormat(format);
    setError(null);

    try {
      const blob =
        format === 'CSV'
          ? await api.adminExportCsv(
              token,
              range.export,
            )
          : await api.adminExportPdf(
              token,
              range.export,
            );

      const url =
        URL.createObjectURL(
          blob,
        );
      const anchor =
        document.createElement(
          'a',
        );

      anchor.href = url;
      anchor.download =
        format === 'CSV'
          ? 'go-virus-admin-metrics.csv'
          : 'go-virus-admin-analytics.pdf';
      document.body.appendChild(
        anchor,
      );
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not export admin analytics',
      );
    } finally {
      setExportingFormat(null);
    }
  }

  if (
    !user ||
    user.role !== 'ADMIN'
  ) {
    return (
      <main className="app-page">
        <PageHeader
          title="Admin"
          description="Platform administration and operational analytics."
        />
        <StatusNotice title="Access restricted">
          Admin role is required
          to view this page.
        </StatusNotice>
      </main>
    );
  }

  return (
    <main className="app-page">
      <PageHeader
        title="Admin"
        description="Operational metrics, interactive analytics, API usage and security activity."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              className="secondary-button"
              disabled={
                Boolean(
                  exportingFormat,
                ) || !overview
              }
              onClick={() =>
                void exportData(
                  'CSV',
                )
              }
            >
              {exportingFormat ===
              'CSV'
                ? 'Exporting…'
                : 'Export CSV'}
            </button>

            <button
              className="secondary-button"
              disabled={
                Boolean(
                  exportingFormat,
                ) || !overview
              }
              onClick={() =>
                void exportData(
                  'PDF',
                )
              }
            >
              {exportingFormat ===
              'PDF'
                ? 'Exporting…'
                : 'Export PDF'}
            </button>
          </div>
        }
      />

      <section className="surface mb-6">
        <div className="surface-header flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">
              Analytics range
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Activity filters are
              calculated in UTC.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label>
              <span className="mb-1 block text-xs text-slate-500">
                Preset
              </span>
              <select
                className="gv-compact-select"
                value={rangeMode}
                onChange={(event) =>
                  setRangeMode(
                    event.target
                      .value as RangeMode,
                  )
                }
              >
                <option value="TODAY">
                  Today
                </option>
                <option value="7D">
                  Last 7 days
                </option>
                <option value="30D">
                  Last 30 days
                </option>
                <option value="CUSTOM">
                  Custom
                </option>
              </select>
            </label>

            {rangeMode ===
              'CUSTOM' && (
              <>
                <label>
                  <span className="mb-1 block text-xs text-slate-500">
                    From
                  </span>
                  <input
                    className="gv-compact-select"
                    type="date"
                    value={
                      customFrom
                    }
                    max={
                      customTo
                    }
                    onChange={(
                      event,
                    ) =>
                      setCustomFrom(
                        event
                          .target
                          .value,
                      )
                    }
                  />
                </label>

                <label>
                  <span className="mb-1 block text-xs text-slate-500">
                    To
                  </span>
                  <input
                    className="gv-compact-select"
                    type="date"
                    value={
                      customTo
                    }
                    min={
                      customFrom
                    }
                    onChange={(
                      event,
                    ) =>
                      setCustomTo(
                        event
                          .target
                          .value,
                      )
                    }
                  />
                </label>
              </>
            )}

            <span className="pb-2 text-xs text-emerald-500">
              Live via WebSocket
            </span>
          </div>
        </div>
      </section>

      {error && (
        <div className="mb-5 rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && !overview ? (
        <section className="surface p-8 text-sm text-slate-500">
          Loading platform
          analytics…
        </section>
      ) : overview ? (
        <div className="space-y-6">
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-sm font-semibold text-slate-300">
                Platform
              </h2>
              <p className="text-xs text-slate-600">
                Generated{' '}
                {formatDate(
                  overview.generatedAt,
                )}
                {lastLiveUpdate
                  ? ' · live refresh ' +
                    formatDate(
                      lastLiveUpdate,
                    )
                  : ''}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Registered users"
                value={
                  overview.users
                    .registered
                }
                detail={
                  overview.users
                    .active +
                  ' active accounts'
                }
              />
              <MetricCard
                label="Online now"
                value={
                  overview.users
                    .onlineNow
                }
                detail="Active session seen in the last 5 minutes"
              />
              <MetricCard
                label="File submissions"
                value={
                  overview
                    .submissions
                    .files
                }
              />
              <MetricCard
                label="URL submissions"
                value={
                  overview
                    .submissions
                    .urls
                }
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
                value={
                  overview.scans
                    .total
                }
                detail={
                  overview.scans
                    .completed +
                  ' completed'
                }
              />
              <MetricCard
                label="Running"
                value={
                  overview.scans
                    .running
                }
              />
              <MetricCard
                label="Failed"
                value={
                  overview.scans
                    .failed
                }
              />
              <MetricCard
                label="Malicious verdicts"
                value={
                  overview.scans
                    .verdicts
                    .MALICIOUS
                }
                detail={
                  overview.scans
                    .verdicts
                    .SUSPICIOUS +
                  ' suspicious'
                }
              />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-300">
              Services
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                label="API requests"
                value={
                  overview.api
                    .requests
                }
                detail={
                  overview.api
                    .requests24h +
                  ' in 24h'
                }
              />
              <MetricCard
                label="API errors 24h"
                value={
                  overview.api
                    .errors24h
                }
                detail={
                  overview.api
                    .activeKeys +
                  ' active keys'
                }
              />
              <MetricCard
                label="Comments"
                value={
                  overview.community
                    .comments
                }
                detail={
                  overview.community
                    .openReports +
                  ' open reports'
                }
              />
              <MetricCard
                label="Community votes"
                value={
                  overview.community
                    .votes
                }
              />
              <MetricCard
                label="LLM requests"
                value={
                  overview.llm
                    .requests
                }
                detail={
                  overview.llm
                    .requests24h +
                  ' in 24h'
                }
              />
            </div>
          </section>

          <section className="surface">
            <div className="surface-header">
              <h2 className="text-sm font-semibold text-slate-200">
                Activity chart
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Toggle series to
                explore daily activity.
              </p>
            </div>

            <div className="surface-body">
              <ActivityChart
                activity={
                  activity
                }
              />
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
                      <th>
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.recentUsers.map(
                      (entry) => (
                        <tr
                          key={
                            entry.id
                          }
                        >
                          <td>
                            <p className="text-slate-300">
                              {
                                entry.username
                              }
                            </p>
                            <p className="text-xs text-slate-600">
                              {
                                entry.email
                              }
                            </p>
                          </td>
                          <td>
                            {
                              entry.role
                            }
                          </td>
                          <td>
                            {
                              entry.status
                            }
                          </td>
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

              {overview
                .recentAudit
                .length ? (
                <div className="divide-y divide-slate-800">
                  {overview.recentAudit.map(
                    (entry) => (
                      <article
                        key={
                          entry.id
                        }
                        className="px-5 py-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <code className="text-xs text-cyan-300">
                            {
                              entry.action
                            }
                          </code>
                          <span className="text-xs text-slate-600">
                            {formatDate(
                              entry.createdAt,
                            )}
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-slate-500">
                          Actor:{' '}
                          {entry.actor
                            ?.username ??
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
                    No audit events
                    yet.
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
