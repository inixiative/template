import { describe, expect, it } from 'bun:test';
import { signUnsubscribe, verifyUnsubscribe } from '#/lib/email/unsubscribe';

describe('unsubscribe token', () => {
  const claim = { userId: 'u1', contactId: 'c1', kind: 'marketing' as const };

  it('round-trips a signed claim', () => {
    expect(verifyUnsubscribe(signUnsubscribe(claim))).toEqual(claim);
  });

  it('rejects a tampered signature', () => {
    expect(verifyUnsubscribe(`${signUnsubscribe(claim)}x`)).toBeNull();
  });

  it('rejects a forged payload reusing a real signature', () => {
    const [, sig] = signUnsubscribe(claim).split('.');
    const forged = Buffer.from(JSON.stringify({ ...claim, kind: 'system' })).toString('base64url');
    expect(verifyUnsubscribe(`${forged}.${sig}`)).toBeNull();
  });

  it('rejects garbage', () => {
    expect(verifyUnsubscribe('not-a-token')).toBeNull();
  });
});
