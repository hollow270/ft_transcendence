import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { PageHeader, StatusNotice } from '../components';
import type { ModerationReport } from '../types';

type ReportStatus =
  | 'OPEN'
  | 'REVIEWING'
  | 'RESOLVED'
  | 'REJECTED';

type Action =
  | 'HIDE_COMMENT'
  | 'DELETE_COMMENT'
  | 'BAN_COMMENTING'
  | 'NO_ACTION';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function ModerationPage() {
  const { token, user } = useAuth();
  const [status, setStatus] =
    useState<ReportStatus>('OPEN');
  const [reports, setReports] =
    useState<ModerationReport[]>([]);
  const [loading, setLoading] =
    useState(Boolean(token));
  const [busyId, setBusyId] =
    useState<string | null>(null);
  const [error, setError] =
    useState<string | null>(null);

  async function load() {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      setReports(
        await api.moderationReports(
          status,
          token,
        ),
      );
    } catch (err) {
      setReports([]);
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load moderation reports',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [token, status]);

  async function resolve(
    report: ModerationReport,
    action: Action,
  ) {
    if (!token) return;

    let reason: string | undefined;
    let banDays: number | undefined;

    if (action !== 'NO_ACTION') {
      reason =
        window.prompt(
          'Optional moderation reason:',
        )?.trim() || undefined;
    }

    if (action === 'BAN_COMMENTING') {
      const value = window.prompt(
        'How many days should commenting be suspended?',
        '7',
      );

      if (value === null) return;

      banDays = Number(value);

      if (
        !Number.isInteger(banDays) ||
        banDays < 1 ||
        banDays > 365
      ) {
        setError(
          'Ban duration must be between 1 and 365 days.',
        );
        return;
      }
    }

    setBusyId(report.id);
    setError(null);

    try {
      await api.resolveModerationReport(
        report.id,
        {
          action,
          ...(reason ? { reason } : {}),
          ...(banDays
            ? { banDays }
            : {}),
        },
        token,
      );
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Moderation action failed',
      );
    } finally {
      setBusyId(null);
    }
  }

  if (
    !user ||
    (user.role !== 'MODERATOR' &&
      user.role !== 'ADMIN')
  ) {
    return (
      <main className="app-page">
        <PageHeader
          title="Moderation"
          description="Review community reports and moderation actions."
        />
        <StatusNotice title="Access restricted">
          Moderator or Admin role is required to use this area.
        </StatusNotice>
      </main>
    );
  }

  return (
    <main className="app-page">
      <PageHeader
        title="Moderation"
        description="Review reported comments and keep an auditable moderation history."
      />

      <section className="surface overflow-hidden">
        <div className="surface-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">
              Comment reports
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {reports.length} report
              {reports.length === 1 ? '' : 's'}
            </p>
          </div>

          <select
            className="gv-compact-select"
            value={status}
            onChange={(event) =>
              setStatus(
                event.target
                  .value as ReportStatus,
              )
            }
          >
            <option value="OPEN">
              Open
            </option>
            <option value="REVIEWING">
              Reviewing
            </option>
            <option value="RESOLVED">
              Resolved
            </option>
            <option value="REJECTED">
              Rejected
            </option>
          </select>
        </div>

        {error && (
          <div className="m-5 rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="empty-state">
            <p className="text-sm text-slate-500">
              Loading reports…
            </p>
          </div>
        ) : reports.length ? (
          <div className="divide-y divide-slate-800">
            {reports.map((report) => (
              <article
                key={report.id}
                className="p-5"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="status-badge border-amber-800 bg-amber-950/40 text-amber-300">
                        {report.reason}
                      </span>
                      <span className="text-xs text-slate-600">
                        {formatDate(
                          report.createdAt,
                        )}
                      </span>
                    </div>

                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                      {report.comment.body}
                    </p>

                    <div className="mt-3 space-y-1 text-xs text-slate-500">
                      <p>
                        Comment by{' '}
                        <span className="text-slate-300">
                          {report.comment.user.username}
                        </span>
                        {' · '}reported by{' '}
                        <span className="text-slate-300">
                          {report.reporter.username}
                        </span>
                      </p>
                      {report.details && (
                        <p>
                          Report details: {report.details}
                        </p>
                      )}
                      <Link
                        className="text-link inline-block"
                        to={
                          '/artifact/' +
                          report.artifact.id
                        }
                      >
                        Open {report.artifact.type.toLowerCase()} artifact: {report.artifact.displayName}
                      </Link>
                    </div>
                  </div>

                  {report.status === 'OPEN' ||
                  report.status ===
                    'REVIEWING' ? (
                    <div className="flex shrink-0 flex-wrap gap-2 xl:max-w-sm xl:justify-end">
                      <button
                        className="secondary-button"
                        disabled={
                          busyId === report.id
                        }
                        onClick={() =>
                          void resolve(
                            report,
                            'HIDE_COMMENT',
                          )
                        }
                      >
                        Hide comment
                      </button>
                      <button
                        className="secondary-button"
                        disabled={
                          busyId === report.id
                        }
                        onClick={() =>
                          void resolve(
                            report,
                            'DELETE_COMMENT',
                          )
                        }
                      >
                        Delete
                      </button>
                      <button
                        className="secondary-button"
                        disabled={
                          busyId === report.id
                        }
                        onClick={() =>
                          void resolve(
                            report,
                            'BAN_COMMENTING',
                          )
                        }
                      >
                        Ban commenting
                      </button>
                      <button
                        className="secondary-button"
                        disabled={
                          busyId === report.id
                        }
                        onClick={() =>
                          void resolve(
                            report,
                            'NO_ACTION',
                          )
                        }
                      >
                        No action
                      </button>
                    </div>
                  ) : (
                    <div className="text-right text-xs text-slate-500">
                      <p>{report.status}</p>
                      <p className="mt-1">
                        {formatDate(
                          report.reviewedAt,
                        )}
                      </p>
                      {report.reviewedBy && (
                        <p className="mt-1">
                          by {report.reviewedBy.username}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p className="text-sm font-semibold text-slate-300">
              No {status.toLowerCase()} reports
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Community reports in this state will appear here.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
