import { afterAll, afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { db } from '@template/db';
import { cleanupTouchedTables } from '@template/db/test';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { authPlugins } from '#/lib/auth/authPlugins';
import type { PersonJwtHandoff } from '#/lib/auth/jwtHandoff';
import { verifyIssuerJwt } from '#/lib/auth/verifyIssuerJwt';

const baseURL = 'http://api.test';
const webCallback = 'http://web.test/auth/callback';

const createAuth = () =>
  betterAuth({
    baseURL,
    secret: 'oauth-callback-token-test-secret-32chars',
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    trustedOrigins: ['http://web.test'],
    socialProviders: {
      google: {
        clientId: 'google-client-id',
        clientSecret: 'google-client-secret',
        getUserInfo: async () => ({
          user: {
            id: 'google-sub-1',
            email: 'oauth@example.com',
            name: 'OAuth User',
            emailVerified: true,
          },
          data: {},
        }),
      },
    },
    user: {
      additionalFields: {
        jwtVersion: { type: 'number', required: false, defaultValue: 0, input: false },
      },
    },
    plugins: authPlugins(),
  });

const verifyOtt = (auth: ReturnType<typeof createAuth>, token: string) =>
  auth.api.verifyOneTimeToken({ body: { token } }) as unknown as Promise<
    PersonJwtHandoff & { user: { id: string; email: string } }
  >;

const sessionCookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .filter((cookie) => cookie.includes('session_token='))
    .at(-1);

const cookieHeader = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');

const completeGoogleCallback = async (auth: ReturnType<typeof createAuth>) => {
  const start = await auth.handler(
    new Request(`${baseURL}/api/auth/sign-in/social`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://web.test' },
      body: JSON.stringify({ provider: 'google', callbackURL: webCallback }),
    }),
  );
  const { url } = (await start.json()) as { url: string };
  const state = new URL(url).searchParams.get('state')!;

  spyOn(globalThis, 'fetch').mockImplementation((async () =>
    Response.json({
      access_token: 'google-access',
      id_token: 'unused',
      expires_in: 3600,
      token_type: 'Bearer',
    })) as unknown as typeof fetch);

  return auth.handler(
    new Request(`${baseURL}/api/auth/callback/google?code=google-code&state=${state}`, {
      headers: { cookie: cookieHeader(start) },
    }),
  );
};

afterEach(() => {
  mock.restore();
});

describe('oauthHandoffPlugins', () => {
  test('the callback redirect carries a one-time token that exchanges for a JWT, never a session', async () => {
    const auth = createAuth();
    const callback = await completeGoogleCallback(auth);

    expect(callback.status).toBe(302);
    const location = new URL(callback.headers.get('location')!);
    expect(`${location.origin}${location.pathname}`).toBe(webCallback);
    expect(location.search).toBe('');
    const ott = new URLSearchParams(location.hash.slice(1)).get('ott');
    expect(ott).toBeTruthy();
    expect(sessionCookieOf(callback)).toContain('Max-Age=0');

    const handoff = await verifyOtt(auth, ott!);
    expect(handoff.user.email).toBe('oauth@example.com');
    expect(Object.keys(handoff).sort()).toEqual(['expiresAt', 'token', 'user']);
    const claims = await verifyIssuerJwt(handoff.token);
    expect(claims.sub).toBe(handoff.user.id);

    const context = await auth.$context;
    expect(await context.internalAdapter.listSessions(handoff.user.id)).toEqual([]);
  });

  test('the one-time token is single-use', async () => {
    const auth = createAuth();
    const callback = await completeGoogleCallback(auth);
    const ott = new URLSearchParams(new URL(callback.headers.get('location')!).hash.slice(1)).get(
      'ott',
    )!;

    await verifyOtt(auth, ott);
    await expect(verifyOtt(auth, ott)).rejects.toThrow('Invalid token');
  });

  test('leaves failed callbacks untouched', async () => {
    const auth = createAuth();
    const callback = await auth.handler(
      new Request(`${baseURL}/api/auth/callback/google?error=access_denied`),
    );

    expect(callback.status).toBe(302);
    expect(callback.headers.get('location')).not.toContain('ott=');
  });

  test('a JWT cannot mint one-time tokens', async () => {
    const auth = createAuth();
    const callback = await completeGoogleCallback(auth);
    const ott = new URLSearchParams(new URL(callback.headers.get('location')!).hash.slice(1)).get(
      'ott',
    )!;
    const { token } = await verifyOtt(auth, ott);

    const generate = await auth.handler(
      new Request(`${baseURL}/api/auth/one-time-token/generate`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    expect(generate.status).toBe(401);
  });
});

describe('auth one-time token wiring', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  test('email sign-in answers with a JWT and leaves no session behind', async () => {
    const { auth } = await import('#/lib/auth');
    const email = `ott-${Bun.randomUUIDv7()}@example.com`;
    const password = 'synthetic-ott-password';
    const { user } = await auth.api.signUpEmail({ body: { name: 'OTT Test', email, password } });
    await db.user.update({ where: { id: user.id }, data: { emailVerified: true } });

    const signIn = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
    const handoff = (await signIn.json()) as PersonJwtHandoff;
    expect((await verifyIssuerJwt(handoff.token)).sub).toBe(user.id);
    expect(sessionCookieOf(signIn) ?? 'Max-Age=0').toContain('Max-Age=0');

    const ott = signIn.headers.get('set-ott');
    expect(ott).toBeTruthy();
    await expect(auth.api.verifyOneTimeToken({ body: { token: ott! } })).rejects.toThrow(
      'Session not found',
    );
    const context = await auth.$context;
    expect(await context.internalAdapter.listSessions(user.id)).toEqual([]);
  });
});
