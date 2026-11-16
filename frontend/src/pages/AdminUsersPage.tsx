import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Avatar, Icon, PageHeader, Spinner, timeAgo } from '../components';
import type { AdminUserRow, AdminUsersResponse } from '../types';

const ROLE_STYLE: Record<AdminUserRow['role'], string> = {
  ADMIN: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  MODERATOR: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  USER: 'border-slate-700 bg-slate-800/50 text-slate-300',
};

export default function AdminUsersPage() {
  const { token, user: me } = useAuth();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ q: '', role: '', status: '', page: 1 });
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    api
      .adminUsers(filters, token)
      .then((response) => {
        setData(response);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load users'))
      .finally(() => setLoading(false));
  }, [token, filters]);

  useEffect(load, [load]);

  function search(event: FormEvent) {
    event.preventDefault();
    setFilters((current) => ({ ...current, q: query, page: 1 }));
  }

  async function update(row: AdminUserRow, payload: { role?: string; status?: string }, message: string) {
    if (!token) return;
    setWorking(row.id);
    setNotice(null);
    try {
      await api.adminUpdateUser(row.id, payload, token);
      setNotice(message);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setWorking(null);
    }
  }

  async function revoke(row: AdminUserRow) {
    if (!token) return;
    setWorking(row.id);
    setNotice(null);
    try {
      const result = await api.adminRevokeUserSessions(row.id, token);
      setNotice(row.username + ' was signed out of ' + result.revoked + ' session(s).');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke sessions');
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="app-page">
      <PageHeader
        title="Users"
        description="Find accounts, change roles, disable access and sign people out. Every change is written to the audit log."
        actions={
          <Link to="/app/admin" className="secondary-button">
            <Icon name="chart" className="h-4 w-4" /> Analytics
          </Link>
        }
      />

      {data && (
        <div className="mb-6 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-slate-800 bg-slate-800 [&>*]:bg-slate-900">
          <div className="px-5 py-4">
            <p className="text-sm text-slate-400">Accounts</p>
            <p className="display-tight mt-1 text-[28px] text-white">{data.totals.active + data.totals.disabled}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm text-slate-400">Active</p>
            <p className="display-tight mt-1 text-[28px] text-emerald-300">{data.totals.active}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm text-slate-400">Disabled</p>
            <p className="display-tight mt-1 text-[28px] text-rose-300">{data.totals.disabled}</p>
          </div>
        </div>
      )}

      <div className="surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-800 p-4 lg:flex-row lg:items-center">
          <form className="flex flex-1 gap-2" onSubmit={search}>
            <div className="relative flex-1">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className="app-input pl-9"
                placeholder="Search by username or email"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <button className="secondary-button">Search</button>
          </form>
          <div className="flex gap-2">
            <select
              className="app-select"
              value={filters.role}
              onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value, page: 1 }))}
              aria-label="Filter by role"
            >
              <option value="">All roles</option>
              <option value="USER">Users</option>
              <option value="MODERATOR">Moderators</option>
              <option value="ADMIN">Admins</option>
            </select>
            <select
              className="app-select"
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}
              aria-label="Filter by status"
            >
              <option value="">Any status</option>
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
            </select>
          </div>
        </div>

        {(error || notice) && (
          <div className="border-b border-slate-800 px-4 py-3">
            {error && <p className="text-sm text-rose-300">{error}</p>}
            {notice && <p className="text-sm text-emerald-300">{notice}</p>}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="data-table min-w-[900px]">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th className="text-right">Scans</th>
                <th className="text-right">Sessions</th>
                <th>Last active</th>
                <th>Joined</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    <span className="inline-flex items-center gap-2"><Spinner /> Loading users</span>
                  </td>
                </tr>
              )}
              {data?.items.map((row) => {
                const self = row.id === me?.id;
                const busy = working === row.id;
                return (
                  <tr key={row.id} className={row.status === 'DISABLED' ? 'opacity-60' : ''}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={row.username} size={32} />
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 font-medium text-white">
                            <Link to={'/app/users/' + row.id + '/community'} className="truncate hover:underline">
                              {row.username}
                            </Link>
                            {row.twoFactorEnabled && (
                              <span title="Two-factor enabled" className="text-emerald-400">
                                <Icon name="shield" className="h-3.5 w-3.5" />
                              </span>
                            )}
                            {self && <span className="text-xs font-normal text-slate-500">(you)</span>}
                          </p>
                          <p className="truncate text-xs text-slate-500">{row.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <select
                        className={'rounded-md border px-2 py-1 text-xs font-semibold outline-none ' + ROLE_STYLE[row.role]}
                        value={row.role}
                        disabled={busy || self}
                        onChange={(event) =>
                          void update(row, { role: event.target.value }, row.username + ' is now ' + event.target.value.toLowerCase() + '.')
                        }
                        aria-label={'Role for ' + row.username}
                      >
                        <option value="USER">User</option>
                        <option value="MODERATOR">Moderator</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </td>
                    <td>
                      <span
                        className={
                          'status-badge gap-1.5 ' +
                          (row.status === 'ACTIVE'
                            ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                            : 'border-rose-500/30 bg-rose-500/10 text-rose-300')
                        }
                      >
                        <span className={'h-1.5 w-1.5 rounded-full ' + (row.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-rose-400')} />
                        {row.status === 'ACTIVE' ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="text-right tabular-nums">{row.submissions}</td>
                    <td className="text-right tabular-nums">{row.activeSessions}</td>
                    <td className="text-slate-400">{timeAgo(row.lastSeenAt)}</td>
                    <td className="text-slate-400">{new Date(row.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        {busy ? (
                          <Spinner />
                        ) : (
                          <>
                            <button
                              className="ghost-button px-2 py-1 text-xs"
                              disabled={!row.activeSessions}
                              onClick={() => void revoke(row)}
                              title="Sign this user out everywhere"
                            >
                              Sign out
                            </button>
                            {!self &&
                              (row.status === 'ACTIVE' ? (
                                <button
                                  className="ghost-button px-2 py-1 text-xs text-rose-300 hover:text-rose-200"
                                  onClick={() => void update(row, { status: 'DISABLED' }, row.username + ' was disabled and signed out.')}
                                >
                                  Disable
                                </button>
                              ) : (
                                <button
                                  className="ghost-button px-2 py-1 text-xs text-emerald-300 hover:text-emerald-200"
                                  onClick={() => void update(row, { status: 'ACTIVE' }, row.username + ' can sign in again.')}
                                >
                                  Enable
                                </button>
                              ))}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {data && !data.items.length && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No accounts match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3 text-sm text-slate-400">
            <span>
              Page {data.page} of {data.totalPages}, {data.total} accounts
            </span>
            <div className="flex gap-2">
              <button
                className="secondary-button py-1.5"
                disabled={data.page <= 1}
                onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
              >
                Previous
              </button>
              <button
                className="secondary-button py-1.5"
                disabled={data.page >= data.totalPages}
                onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
