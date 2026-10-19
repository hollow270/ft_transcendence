import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { PageHeader, StatusNotice } from '../components';

function DisabledField({
  label,
  placeholder,
}: {
  label: string;
  placeholder: string;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      <input className="app-input" placeholder={placeholder} disabled />
    </label>
  );
}

export function UrlPage() {
  return (
    <main className="app-page">
      <PageHeader
        title="URL analysis"
        description="Submit a URL for normalization, deduplication and security analysis."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="surface">
          <div className="surface-header">
            <h2 className="text-sm font-semibold text-slate-200">Analyze URL</h2>
          </div>
          <div className="surface-body">
            <DisabledField label="URL" placeholder="https://example.com/path" />
            <div className="mt-4 flex justify-end">
              <button className="primary-button" disabled>Analyze URL</button>
            </div>
          </div>
        </section>

        <StatusNotice title="URL analysis is not connected yet.">
          The Prisma model is ready, but the NestJS endpoint for URL normalization, submission,
          freshness checks and engine analysis still needs to be implemented.
        </StatusNotice>
      </div>
    </main>
  );
}

export function SearchPage() {
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';

  return (
    <main className="app-page">
      <PageHeader
        title="Search"
        description="Find public artifacts by hash or artifact identifier."
      />

      <section className="surface">
        <div className="surface-header flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Search results</h2>
            {query && <p className="mt-1 text-xs text-slate-500">Query: {query}</p>}
          </div>
        </div>
        <div className="empty-state">
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-slate-600" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" />
          </svg>
          <h2 className="mt-3 text-sm font-semibold text-slate-300">Search API not connected</h2>
          <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
            The route is ready, but no backend endpoint exists yet. Private submissions will remain excluded when search is implemented.
          </p>
        </div>
      </section>
    </main>
  );
}

export function HistoryPage() {
  const { user } = useAuth();

  return (
    <main className="app-page">
      <PageHeader
        title="History"
        description="Your file and URL submissions, scan status, visibility and recent activity."
      />

      {!user ? (
        <StatusNotice title="Sign in required">
          Submission history belongs to a user account and cannot be shown in anonymous mode.
        </StatusNotice>
      ) : (
        <section className="surface overflow-hidden">
          <div className="surface-header flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Submissions</h2>
            <div className="flex gap-2">
              <button className="secondary-button" disabled>Filter</button>
              <button className="secondary-button" disabled>Export</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Artifact</th>
                  <th>Type</th>
                  <th>Visibility</th>
                  <th>Verdict</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <p className="text-sm font-semibold text-slate-300">History endpoint not connected</p>
                      <p className="mt-1 max-w-md text-sm text-slate-500">
                        The page structure is ready. The backend still needs an authenticated submissions/history endpoint.
                      </p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

export function SecurityPage() {
  const { user } = useAuth();

  return (
    <main className="app-page">
      <PageHeader
        title="Security"
        description="Manage account security and two-factor authentication."
      />

      {!user ? (
        <StatusNotice title="Sign in required">
          Account security settings are only available to authenticated users.
        </StatusNotice>
      ) : (
        <div className="max-w-3xl space-y-5">
          <section className="surface">
            <div className="surface-header">
              <h2 className="text-sm font-semibold text-slate-200">Two-factor authentication</h2>
            </div>
            <div className="surface-body flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-300">Authenticator app</p>
                <p className="mt-1 text-sm text-slate-500">
                  Add a second verification step when signing in.
                </p>
              </div>
              <button className="secondary-button" disabled>Set up 2FA</button>
            </div>
          </section>

          <StatusNotice title="2FA backend is pending">
            The UserTwoFactor model exists, but secure provisioning, verification and disable endpoints are not implemented yet.
          </StatusNotice>
        </div>
      )}
    </main>
  );
}

export function ApiKeysPage() {
  const { user } = useAuth();

  return (
    <main className="app-page">
      <PageHeader
        title="API keys"
        description="Create and revoke credentials for the public GO VIRUS API."
        actions={<button className="primary-button" disabled>Create API key</button>}
      />

      {!user ? (
        <StatusNotice title="Sign in required">
          API credentials belong to a registered account.
        </StatusNotice>
      ) : (
        <section className="surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Prefix</th>
                  <th>Rate limit</th>
                  <th>Last used</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <p className="text-sm font-semibold text-slate-300">API management endpoint not connected</p>
                      <p className="mt-1 max-w-lg text-sm text-slate-500">
                        Keys will be displayed here after creation. Only a safe prefix will be retained for display; the plaintext key should be shown once.
                      </p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

export function ModerationPage() {
  const { user } = useAuth();

  if (user?.role !== 'MODERATOR' && user?.role !== 'ADMIN') {
    return (
      <main className="app-page">
        <PageHeader title="Moderation" description="Review community reports and moderation actions." />
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
        description="Review reported comments, apply actions and keep an auditable moderation history."
      />
      <section className="surface overflow-hidden">
        <div className="surface-header flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Open reports</h2>
          <button className="secondary-button" disabled>Filter</button>
        </div>
        <div className="empty-state">
          <p className="text-sm font-semibold text-slate-300">Moderation API not connected</p>
          <p className="mt-1 max-w-lg text-sm text-slate-500">
            CommentReport and ModerationAction are modeled, but review and action endpoints are still pending.
          </p>
        </div>
      </section>
    </main>
  );
}

export function AdminPage() {
  const { user } = useAuth();

  if (user?.role !== 'ADMIN') {
    return (
      <main className="app-page">
        <PageHeader title="Admin" description="Platform administration and analytics." />
        <StatusNotice title="Access restricted">
          Admin role is required to view this page.
        </StatusNotice>
      </main>
    );
  }

  const metrics = [
    ['Registered users', '—'],
    ['Online now', '—'],
    ['File submissions', '—'],
    ['URL submissions', '—'],
    ['Scans', '—'],
    ['API requests', '—'],
  ];

  return (
    <main className="app-page">
      <PageHeader
        title="Admin"
        description="Platform metrics, usage, security activity and exports."
        actions={
          <div className="flex gap-2">
            <button className="secondary-button" disabled>Export CSV</button>
            <button className="secondary-button" disabled>Export PDF</button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(([label, value]) => (
          <section key={label} className="surface p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-200">{value}</p>
          </section>
        ))}
      </div>

      <div className="mt-6">
        <StatusNotice title="Analytics API not connected">
          The canonical database records exist, but aggregate metric, filtering and export endpoints still need to be implemented.
        </StatusNotice>
      </div>
    </main>
  );
}
