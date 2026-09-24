import { afterAll, afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { db } from '@template/db';
import { cleanupTouchedTables, registerTestTracker } from '@template/db/test';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { bearer } from 'better-auth/plugins';
import { oauthHandoffPlugins } from '#/lib/auth/oauthHandoffPlugins';

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
          user: { id: 'google-sub-1', email: 'oauth@example.com', name: 'OAuth User', emailVerified: true },
          data: {},
        }),
      },
    },
    plugins: [bearer(), ...oauthHandoffPlugins()],
  });

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
  test('appends a one-time token to the callback redirect that exchanges for a bearer session', async () => {
    const auth = createAuth();
    const callback = await completeGoogleCallback(auth);

    expect(callback.status).toBe(302);
    const location = new URL(callback.headers.get('location')!);
    expect(`${location.origin}${location.pathname}`).toBe(webCallback);
    expect(location.search).toBe('');
    const ott = new URLSearchParams(location.hash.slice(1)).get('ott');
    expect(ott).toBeTruthy();

    const verified = await auth.api.verifyOneTimeToken({ body: { token: ott! } });
    expect(verified.user.email).toBe('oauth@example.com');

    const session = await auth.api.getSession({
      headers: new Headers({ authorization: `Bearer ${verified.session.token}` }),
    });
    expect(session?.user.email).toBe('oauth@example.com');
  });

  test('the one-time token is single-use', async () => {
    const auth = createAuth();
    const callback = await completeGoogleCallback(auth);
    const ott = new URLSearchParams(new URL(callback.headers.get('location')!).hash.slice(1)).get('ott')!;

    await auth.api.verifyOneTimeToken({ body: { token: ott } });
    await expect(auth.api.verifyOneTimeToken({ body: { token: ott } })).rejects.toThrow('Invalid token');
  });

  test('leaves failed callbacks untouched', async () => {
    const auth = createAuth();
    const callback = await auth.handler(new Request(`${baseURL}/api/auth/callback/google?error=access_denied`));

    expect(callback.status).toBe(302);
    expect(callback.headers.get('location')).not.toContain('ott=');
  });

  test('browsers cannot mint one-time tokens directly', async () => {
    const auth = createAuth();
    const callback = await completeGoogleCallback(auth);
    const ott = new URLSearchParams(new URL(callback.headers.get('location')!).hash.slice(1)).get('ott')!;
    const { session } = await auth.api.verifyOneTimeToken({ body: { token: ott } });

    const generate = await auth.handler(
      new Request(`${baseURL}/api/auth/one-time-token/generate`, {
        headers: { authorization: `Bearer ${session.token}` },
      }),
    );
    expect(generate.status).toBe(400);
  });
});

describe('auth one-time token wiring', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  test('a new session gets a one-time token that exchanges for a working bearer token', async () => {
    registerTestTracker();
    const { auth } = await import('#/lib/auth');
    const email = `ott-${Bun.randomUUIDv7()}@example.com`;
    const password = 'synthetic-ott-password';
    const { user } = await auth.api.signUpEmail({ body: { name: 'OTT Test', email, password } });
    await db.user.update({ where: { id: user.id }, data: { emailVerified: true } });

    const signIn = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
    const ott = signIn.headers.get('set-ott');
    expect(ott).toBeTruthy();

    const verified = await auth.api.verifyOneTimeToken({ body: { token: ott! } });
    const session = await auth.api.getSession({
      headers: new Headers({ authorization: `Bearer ${verified.session.token}` }),
    });
    expect(session?.user.id).toBe(user.id);
  });
});
