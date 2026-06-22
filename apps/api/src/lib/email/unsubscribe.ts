/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses none
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CommunicationKind } from '@template/db';

// A signed capability over the exact (user, contact, kind) intersection — the only thing the link
// can do is unsubscribe that one contact from that one kind. Stateless: re-derived, never stored.
export type UnsubscribeClaim = { userId: string | null; contactId: string; kind: CommunicationKind };

// Domain-separated HMAC off BETTER_AUTH_SECRET (no dedicated env var). The fallback only applies when
// the secret is absent (dev/test) — never in prod, where BETTER_AUTH_SECRET is required.
const sign = (body: string): string =>
  createHmac('sha256', process.env.BETTER_AUTH_SECRET ?? 'insecure-dev-only-unsubscribe-key')
    .update(`email-unsubscribe:${body}`)
    .digest('base64url');

export const signUnsubscribe = (claim: UnsubscribeClaim): string => {
  const body = Buffer.from(JSON.stringify(claim)).toString('base64url');
  return `${body}.${sign(body)}`;
};

export const unsubscribeUrl = (claim: UnsubscribeClaim): string =>
  `${process.env.API_URL ?? ''}/unsubscribe?token=${signUnsubscribe(claim)}`;

export const verifyUnsubscribe = (token: string): UnsubscribeClaim | null => {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString()) as UnsubscribeClaim;
  } catch {
    return null;
  }
};
