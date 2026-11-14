import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Anonymous scans receive a signed claim token so the visitor can attach the
 * submission to the account they create afterwards. The token is an HMAC of
 * the submission id; it is never stored, and the submission id alone (which is
 * visible on public reports) is not enough to claim it.
 *
 * Set CLAIM_TOKEN_SECRET for tokens that survive backend restarts. Without it a
 * per-process random secret is used.
 */
const secret =
  (process.env.CLAIM_TOKEN_SECRET ?? '').trim() ||
  randomBytes(32).toString('hex');

export function signClaimToken(submissionId: string) {
  return createHmac('sha256', secret)
    .update('claim:' + submissionId)
    .digest('base64url');
}

export function verifyClaimToken(submissionId: string, token: string) {
  const expected = Buffer.from(signClaimToken(submissionId));
  const actual = Buffer.from(token ?? '');

  return (
    expected.length === actual.length &&
    timingSafeEqual(expected, actual)
  );
}
