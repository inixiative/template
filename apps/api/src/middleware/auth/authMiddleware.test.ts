import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { cleanupTouchedTables } from '@template/db/test';
import { app } from '#/app';
import { auth } from '#/lib/auth';

type SignedIn = { userId: string; token: string; cookie: string };

const signIn = async (): Promise<SignedIn> => {
  const email = `bearer-only-${Bun.randomUUIDv7()}@example.com`;
  const password = 'synthetic-bearer-only-password';
  const { user } = await auth.api.signUpEmail({ body: { name: 'Bearer Only', email, password } });
  await db.user.update({ where: { id: user.id }, data: { emailVerified: true } });

  const response = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
  const { token } = (await response.json()) as { token: string };
  const cookie = response.headers
    .getSetCookie()
    .map((setCookie) => setCookie.split(';')[0])
    .join('; ');
  return { userId: user.id, token, cookie };
};

const readMe = (headers: Record<string, string>, query = '') =>
  app.request(`/api/v1/me${query}`, { headers });

describe('authMiddleware is bearer-only', () => {
  let signedIn: SignedIn;

  beforeAll(async () => {
    signedIn = await signIn();
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('sign-in sets a session cookie, so the cookie-only case below is a real cookie', () => {
    expect(signedIn.cookie).toContain('session_token=');
  });

  it('authenticates the session token sent as a bearer header', async () => {
    const response = await readMe({ authorization: `Bearer ${signedIn.token}` });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { id: string } };
    expect(body.data.id).toBe(signedIn.userId);
  });

  it('authenticates the session token sent as ?token=', async () => {
    const response = await readMe({}, `?token=${encodeURIComponent(signedIn.token)}`);
    expect(response.status).toBe(200);
  });

  it('a valid session cookie alone authenticates no one', async () => {
    const response = await readMe({ cookie: signedIn.cookie });
    expect(response.status).toBe(401);
  });

  it('a revoked bearer session is rejected on the next request', async () => {
    const revoked = await signIn();
    const bearer = { authorization: `Bearer ${revoked.token}` };
    expect((await readMe(bearer)).status).toBe(200);

    await auth.api.revokeSession({
      headers: new Headers(bearer),
      body: { token: revoked.token },
    });

    expect((await readMe(bearer)).status).toBe(401);
    expect((await readMe({ ...bearer, cookie: revoked.cookie })).status).toBe(401);
  });
});
