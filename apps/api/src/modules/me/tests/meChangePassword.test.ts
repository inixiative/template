import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { db, getRedisClient, redisNamespace, unregisterDbHook } from '@template/db';
import { PlatformRole } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createUser } from '@template/db/test';
import { passwordLength } from '@template/shared/auth/passwordLength';
import { app } from '#/app';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { auth } from '#/lib/auth';
import type { UserJwtHandoff } from '#/lib/auth/jwtHandoff';
import { rateLimitMax } from '#/middleware/rateLimit/limits';
import { createBearerToken } from '#tests/utils/createBearerToken';
import { createUserJwt } from '#tests/utils/createUserJwt';

beforeAll(() => registerClearCacheHook());
afterAll(async () => {
  unregisterDbHook('clearCache');
  await cleanupTouchedTables(db);
});

beforeEach(async () => {
  const keys = [
    ...(await getRedisClient().keys(`${redisNamespace.limit}:auth:*`)),
    ...(await getRedisClient().keys(`${redisNamespace.limit}:credentialChange:*`)),
  ];
  if (keys.length) await getRedisClient().del(...keys);
});

const json = { 'content-type': 'application/json' };
const bearer = (credential: string) => ({ authorization: `Bearer ${credential}` });
const readMe = (credential: string) => app.request('/api/v1/me', { headers: bearer(credential) });
const currentPassword = 'synthetic-current-password';
const newPassword = 'synthetic-new-password';

const signUpVerified = async () => {
  const email = `change-password-${Bun.randomUUIDv7()}@example.com`;
  const { user } = await auth.api.signUpEmail({
    body: { name: 'Password Person', email, password: currentPassword },
  });
  await db.user.update({ where: { id: user.id }, data: { emailVerified: true } });
  return { userId: user.id, email };
};

const signIn = (email: string, password: string) =>
  app.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ email, password }),
  });

const signedInJwt = async (email: string, password = currentPassword) =>
  ((await (await signIn(email, password)).json()) as UserJwtHandoff).token;

const changePassword = (
  credential: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) =>
  app.request('/api/v1/me/changePassword', {
    method: 'POST',
    headers: { ...json, ...bearer(credential), ...headers },
    body: JSON.stringify(body),
  });

const sessionsOf = async (userId: string) =>
  (await auth.$context).internalAdapter.listSessions(userId);

describe('POST /api/v1/me/changePassword', () => {
  it('sets the password, revokes every older JWT and answers with a new JWT', async () => {
    const person = await signUpVerified();
    const jwt = await signedInJwt(person.email);
    const otherDevice = await signedInJwt(person.email);
    expect((await readMe(otherDevice)).status).toBe(200);

    const response = await changePassword(jwt, { currentPassword, newPassword });
    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: UserJwtHandoff };
    expect(Object.keys(data).sort()).toEqual(['expiresAt', 'token']);
    expect(data.token.split('.')).toHaveLength(3);
    expect(new Date(data.expiresAt).getTime()).toBeGreaterThan(Date.now());

    expect((await readMe(jwt)).status).toBe(401);
    expect((await readMe(otherDevice)).status).toBe(401);
    expect((await readMe(data.token)).status).toBe(200);
    expect((await signIn(person.email, currentPassword)).status).toBe(401);
    expect((await signIn(person.email, newPassword)).status).toBe(200);
  });

  it('leaves no Better Auth session behind', async () => {
    const person = await signUpVerified();
    const response = await changePassword(await signedInJwt(person.email), {
      currentPassword,
      newPassword,
    });
    expect(response.status).toBe(200);
    expect(await sessionsOf(person.userId)).toEqual([]);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('a wrong current password changes nothing', async () => {
    const person = await signUpVerified();
    const jwt = await signedInJwt(person.email);
    const response = await changePassword(jwt, {
      currentPassword: 'not-the-current-password',
      newPassword,
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { message: string };
    expect(body.message).toBe('Invalid password');
    expect(await sessionsOf(person.userId)).toEqual([]);
    expect((await readMe(jwt)).status).toBe(200);
    expect((await signIn(person.email, currentPassword)).status).toBe(200);
    expect((await signIn(person.email, newPassword)).status).toBe(401);
  });

  it('refuses a new password outside Better Auth length limits before calling it', async () => {
    const person = await signUpVerified();
    const jwt = await signedInJwt(person.email);
    const short = 'x'.repeat(passwordLength.min - 1);
    const long = 'x'.repeat(passwordLength.max + 1);
    for (const candidate of [short, long]) {
      const response = await changePassword(jwt, { currentPassword, newPassword: candidate });
      expect(response.status).toBe(422);
    }
    expect((await readMe(jwt)).status).toBe(200);
    expect((await signIn(person.email, currentPassword)).status).toBe(200);
  });

  it('an API token cannot change its user’s password', async () => {
    const person = await signUpVerified();
    const user = await db.user.findUniqueOrThrow({ where: { id: person.userId } });
    const { rawKey } = await createBearerToken(user);
    const response = await changePassword(rawKey, { currentPassword, newPassword });
    expect(response.status).toBe(403);
    expect((await signIn(person.email, currentPassword)).status).toBe(200);
  });

  it('needs a signed-in person', async () => {
    const response = await app.request('/api/v1/me/changePassword', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    expect(response.status).toBe(401);
  });

  it('Better Auth’s own /change-password stays disabled over HTTP', async () => {
    const response = await app.request('/api/auth/change-password', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    expect(response.status).toBe(404);
  });

  it('allows a person five attempts a minute', async () => {
    const person = await signUpVerified();
    const jwt = await signedInJwt(person.email);
    const max = rateLimitMax('credentialChange', {} as never);
    const statuses: number[] = [];
    for (let i = 0; i <= max; i += 1)
      statuses.push(
        (await changePassword(jwt, { currentPassword: 'not-the-current-password', newPassword }))
          .status,
      );
    expect(statuses.slice(0, max).every((status) => status === 400)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it('a token’s refused calls do not use up the person’s attempts', async () => {
    const person = await signUpVerified();
    const user = await db.user.findUniqueOrThrow({ where: { id: person.userId } });
    const { rawKey } = await createBearerToken(user);
    const max = rateLimitMax('credentialChange', {} as never);
    for (let i = 0; i <= max; i += 1)
      expect((await changePassword(rawKey, { currentPassword, newPassword })).status).toBe(403);
    const jwt = await signedInJwt(person.email);
    const response = await changePassword(jwt, {
      currentPassword: 'not-the-current-password',
      newPassword,
    });
    expect(response.status).toBe(400);
  });

  it('shares the /api/auth rate limit per IP', async () => {
    const headers = { 'x-forwarded-for': '198.51.100.78' };
    const max = rateLimitMax('auth', {} as never);
    for (let i = 0; i < max; i += 1)
      await app.request('/api/auth/ok', { headers: { ...headers, ...json } });
    const person = await signUpVerified();
    const jwt = await signedInJwt(person.email);
    const response = await changePassword(jwt, { currentPassword, newPassword }, headers);
    expect(response.status).toBe(429);
    expect((await signIn(person.email, currentPassword)).status).toBe(200);
  });

  it('a spoofing superadmin changes the spoofed user’s password like any other action', async () => {
    const person = await signUpVerified();
    const { entity: admin } = await createUser({ platformRole: PlatformRole.superadmin });
    const { jwt } = await createUserJwt(admin);
    const response = await changePassword(
      jwt,
      { currentPassword, newPassword },
      { 'x-spoof-user-email': person.email },
    );
    expect(response.status).toBe(200);
    expect((await signIn(person.email, newPassword)).status).toBe(200);
    expect((await signIn(person.email, currentPassword)).status).not.toBe(200);
  });

  it('a spoofing superadmin gets no JWT for the spoofed user back', async () => {
    const person = await signUpVerified();
    const personJwt = await signedInJwt(person.email);
    const { entity: admin } = await createUser({ platformRole: PlatformRole.superadmin });
    const { jwt } = await createUserJwt(admin);
    const response = await changePassword(
      jwt,
      { currentPassword, newPassword },
      { 'x-spoof-user-email': person.email },
    );
    expect(response.status).toBe(200);
    expect(((await response.json()) as { data: unknown }).data).toEqual({
      token: null,
      expiresAt: null,
    });
    expect((await readMe(personJwt)).status).toBe(401);
    expect((await readMe(jwt)).status).toBe(200);
  });

  it('two concurrent changes: one wins, the other is refused without a 401, no session left', async () => {
    const person = await signUpVerified();
    const jwt = await signedInJwt(person.email);
    const responses = await Promise.all([
      changePassword(jwt, { currentPassword, newPassword }),
      changePassword(jwt, { currentPassword, newPassword: 'synthetic-other-password' }),
    ]);
    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).not.toContain(401);
    expect(statuses.filter((status) => status === 200).length).toBeGreaterThanOrEqual(1);
    expect(await sessionsOf(person.userId)).toEqual([]);
  });
});
