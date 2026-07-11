import { describe, expect, it } from 'bun:test';
import { auth } from '#/lib/auth';

describe('dbg3', () => {
  it('signup direct return token', async () => {
    const email = `probe-${crypto.randomUUID()}@test.dev`;
    const out = await auth.api.signUpEmail({ body: { email, password: 'test-password-123', name: 'Probe User' } });
    console.log('XKEYS', Object.keys(out ?? {}), 'XTOKEN', (out as { token?: string })?.token?.slice(0, 10) ?? null);
    const token = (out as { token?: string })?.token;
    if (token) {
      const got = await auth.api.getSession({ headers: new Headers({ authorization: `Bearer ${token}` }) });
      console.log('XGOT', got?.user?.email ?? null);
    }
    expect(true).toBe(true);
  });
});
