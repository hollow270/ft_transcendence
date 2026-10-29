import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';
import { FeaturePending } from '../components';

export function UrlPage() {
  return (
    <FeaturePending
      title="URL analysis"
      description="The Prisma data model already supports URL artifacts and scan history, but the NestJS URL submission/scanning endpoint has not been implemented yet."
      requirement="Next backend milestone: normalize the URL, deduplicate it with url_hash, create a Submission, apply the 7-day freshness rule and store per-engine scan results."
    />
  );
}

export function SearchPage() {
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';

  return (
    <FeaturePending
      title={query ? 'Search: ' + query : 'Artifact search'}
      description="The interface route is ready, but there is no backend search endpoint yet. The UI will not fabricate search results."
      requirement="Planned search covers public file hashes, public URLs and artifacts only. Private submissions must remain excluded."
    />
  );
}

export function HistoryPage() {
  const { user } = useAuth();

  return (
    <FeaturePending
      title="Submission history"
      description={
        user
          ? 'You are signed in. The history page is ready in the navigation, but the backend history endpoint is not implemented yet.'
          : 'Sign in to use personal submission history once the backend endpoint is implemented.'
      }
      requirement="History should read the authenticated user's submissions and scans without exposing another user's private activity."
    />
  );
}

export function SecurityPage() {
  const { user } = useAuth();

  return (
    <FeaturePending
      title="Account security / 2FA"
      description={
        user
          ? 'The user_2fa Prisma model exists, but setup, verification, recovery and disable endpoints are still pending.'
          : 'Sign in before configuring account security.'
      }
      requirement="This page will manage two-factor authentication only after the backend can securely provision and verify 2FA secrets."
    />
  );
}

export function ApiKeysPage() {
  const { user } = useAuth();

  return (
    <FeaturePending
      title="API keys"
      description={
        user
          ? 'The ApiKey and ApiRequestLog models exist, but key creation, revocation, rate-limit and usage endpoints are not implemented yet.'
          : 'Sign in to manage API keys once the public API backend is available.'
      }
      requirement="Plaintext API keys must only be shown once at creation; the database stores only key hashes and safe prefixes."
    />
  );
}

export function ModerationPage() {
  const { user } = useAuth();

  if (user?.role !== 'MODERATOR' && user?.role !== 'ADMIN') {
    return (
      <FeaturePending
        title="Moderation"
        description="This area is restricted to Moderator and Admin roles."
      />
    );
  }

  return (
    <FeaturePending
      title="Moderation queue"
      description="The CommentReport and ModerationAction models exist, but report-review and moderation endpoints are still pending."
      requirement="The final queue will support reviewing reports, hiding/restoring/deleting comments and comment bans with an auditable action history."
    />
  );
}

export function AdminPage() {
  const { user } = useAuth();

  if (user?.role !== 'ADMIN') {
    return (
      <FeaturePending
        title="Admin dashboard"
        description="This area is restricted to Admin users."
      />
    );
  }

  return (
    <FeaturePending
      title="Admin analytics"
      description="The database already stores the canonical data needed for analytics, but aggregate dashboard/export endpoints are not implemented yet."
      requirement="Planned metrics include registered/online/new users, file/URL submissions, scans, verdict distribution, comments, votes, API usage and LLM usage with date filters and PDF/CSV export."
    />
  );
}
