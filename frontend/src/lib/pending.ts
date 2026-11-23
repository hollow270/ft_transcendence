import { api } from '../api';

/**
 * An anonymous scan started on the landing page. Kept in sessionStorage so the
 * report can be attached to the account the visitor creates next.
 */
export type PendingScan = {
  artifactId: string;
  submissionId: string;
  claimToken: string;
  name: string;
  verdict?: string;
  createdAt: number;
};

const KEY = 'gv.pendingScan';

export function savePendingScan(scan: PendingScan) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(scan));
  } catch {
    // Storage can be unavailable (private mode); the report link still works.
  }
}

export function readPendingScan(): PendingScan | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as PendingScan;
    // Server-side claims expire after 24h.
    if (Date.now() - value.createdAt > 24 * 60 * 60 * 1000) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function clearPendingScan() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Attaches the pending anonymous scan to the signed-in account. */
export async function claimPendingScan(token: string) {
  const pending = readPendingScan();
  if (!pending) return null;

  try {
    await api.claimSubmission(
      { submissionId: pending.submissionId, claimToken: pending.claimToken },
      token,
    );
  } catch {
    // The report is public either way; claiming only adds it to history.
  }

  clearPendingScan();
  return pending.artifactId;
}
