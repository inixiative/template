import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { db, unregisterDbHook } from '@template/db';
import type { User } from '@template/db/generated/client/client';
import { PlatformRole } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createUser,
} from '@template/db/test';
import { setEnvOverride } from '@template/shared/utils';
import { exportJWK, generateKeyPair, type JWTPayload, SignJWT } from 'jose';
import { app } from '#/app';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { auth } from '#/lib/auth';
import type { PersonJwtHandoff } from '#/lib/auth/jwtHandoff';
import { selfIssuer } from '#/lib/auth/personJwt';
import { rotateUserJwts } from '#/modules/user/services/rotateUserJwts';
import { resolveIdentity } from '#/ws/probe';
import { createBearerToken } from '#tests/utils/createBearerToken';
import { createUserJwt } from '#tests/utils/createUserJwt';

// Revocation and role changes reach the next request through the cache hooks the app registers.
beforeAll(() => registerClearCacheHook());
afterAll(() => unregisterDbHook('clearCache'));

const nowSeconds = () => Math.floor(Date.now() / 1000);

const readMe = (headers: Record<string, string>, query = '') =>
  app.request(`/api/v1/me${query}`, { headers });

const bearer = (jwt: string) => ({ authorization: `Bearer ${jwt}` });

const signUpVerified = async () => {
  const email = `jwt-${Bun.randomUUIDv7()}@example.com`;
  const password = 'synthetic-jwt-password';
  const { user } = await auth.api.signUpEmail({ body: { name: 'JWT Person', email, password } });
  await db.user.update({ where: { id: user.id }, data: { emailVerified: true } });
  return { userId: user.id, email, password };
};

const signInOverHttp = async (email: string, password: string) =>
  app.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

describe('a person authenticates with a JWT, never a session', () => {
  let person: Awaited<ReturnType<typeof signUpVerified>>;
  let signIn: Response;
  let handoff: PersonJwtHandoff & { user: { id: string } };

  beforeAll(async () => {
    person = await signUpVerified();
    signIn = await signInOverHttp(person.email, person.password);
    handoff = (await signIn.clone().json()) as typeof handoff;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('sign-in answers with a 30-day JWT and nothing else', async () => {
    expect(signIn.status).toBe(200);
    expect(Object.keys(handoff).sort()).toEqual(['expiresAt', 'token', 'user']);
    expect(handoff.token.split('.')).toHaveLength(3);
    const days = (new Date(handoff.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
  });

  it('sign-in leaves no session: none stored, and the session cookie is expired', async () => {
    const context = await auth.$context;
    expect(await context.internalAdapter.listSessions(person.userId)).toEqual([]);
    const sessionCookies = signIn.headers
      .getSetCookie()
      .filter((cookie) => cookie.includes('session_token='));
    expect(sessionCookies.at(-1) ?? 'Max-Age=0').toContain('Max-Age=0');
  });

  it('sign-in stamps lastLoginAt', async () => {
    const user = await db.user.findUniqueOrThrow({ where: { id: person.userId } });
    expect(user.lastLoginAt).not.toBeNull();
  });

  it('neither sign-in nor /me returns jwtVersion', async () => {
    expect(handoff.user).not.toHaveProperty('jwtVersion');
    const me = (await (await readMe(bearer(handoff.token))).json()) as { data: object };
    expect(me.data).toHaveProperty('id');
    expect(me.data).not.toHaveProperty('jwtVersion');
  });

  it('a sign-up waiting for email verification does not return jwtVersion', async () => {
    const response = await app.request('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Pending Person',
        email: `pending-${Bun.randomUUIDv7()}@example.com`,
        password: 'synthetic-pending-password',
      }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { token: null; user: Record<string, unknown> };
    expect(body.token).toBeNull();
    expect(body.user).toHaveProperty('id');
    expect(body.user).not.toHaveProperty('jwtVersion');
  });

  it('the JWT authenticates API requests as the person', async () => {
    const response = await readMe(bearer(handoff.token));
    expect(response.status).toBe(200);
    expect(((await response.json()) as { data: { id: string } }).data.id).toBe(person.userId);
  });

  it('a JWT in the URL authenticates no one', async () => {
    const response = await readMe({}, `?token=${encodeURIComponent(handoff.token)}`);
    expect(response.status).toBe(401);
  });

  it('a Better Auth session token authenticates no one, as a bearer, a cookie or ?token=', async () => {
    const context = await auth.$context;
    const session = await context.internalAdapter.createSession(person.userId);
    expect((await readMe(bearer(session.token))).status).toBe(401);
    expect((await readMe({ cookie: `better-auth.session_token=${session.token}` })).status).toBe(
      401,
    );
    expect((await readMe({}, `?token=${session.token}`)).status).toBe(401);
    await context.internalAdapter.deleteSession(session.token);
  });

  it('no endpoint under /api/auth turns a session into a JWT or acts on one', async () => {
    const context = await auth.$context;
    const session = await context.internalAdapter.createSession(person.userId);
    const headers = {
      authorization: `Bearer ${session.token}`,
      cookie: `better-auth.session_token=${session.token}`,
      'content-type': 'application/json',
    };
    const calls: Array<[string, string]> = [
      ['GET', '/token'],
      ['GET', '/get-session'],
      ['GET', '/list-sessions'],
      ['POST', '/sign-out'],
      ['POST', '/change-password'],
      ['POST', '/update-user'],
      ['POST', '/revoke-sessions'],
      ['GET', '/one-time-token/generate'],
    ];
    expect((await app.request('/api/auth/ok')).status).toBe(200);
    for (const [method, path] of calls) {
      const response = await app.request(`/api/auth${path}`, {
        method,
        headers,
        body: method === 'POST' ? '{}' : undefined,
      });
      expect(`${method} ${path} ${response.status}`).toBe(`${method} ${path} 404`);
    }
    await context.internalAdapter.deleteSession(session.token);
  });

  it('a sign-in right after revoking every JWT gets a working JWT', async () => {
    await rotateUserJwts(person.userId);
    const again = await signInOverHttp(person.email, person.password);
    const { token } = (await again.json()) as PersonJwtHandoff;
    expect((await readMe(bearer(token))).status).toBe(200);
  });

  it('publishes its signing keys', async () => {
    const response = await app.request('/api/auth/jwks');
    expect(response.status).toBe(200);
    const { keys } = (await response.json()) as { keys: Array<{ alg: string; d?: string }> };
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((key) => key.alg === 'ES256' && key.d === undefined)).toBe(true);
  });

  it('stores signing keys encrypted by the template field encryption', async () => {
    const rows = await db.jwks.findMany();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.encryptedPrivateKeyKeyVersion).toBe(1);
      expect(row.encryptedPrivateKey).not.toContain('"d"');
    }
  });
});

describe('JWT verification', () => {
  let user: User;

  beforeAll(async () => {
    ({ entity: user } = await createUser());
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  const signSelf = async (payload: JWTPayload, overrideOptions?: Record<string, unknown>) =>
    (
      await auth.api.signJWT({
        body: { payload: { sub: user.id, iat: nowSeconds(), ...payload }, overrideOptions },
      })
    ).token;

  it('rejects a tampered JWT', async () => {
    const { jwt } = await createUserJwt(user);
    const [header, , signature] = jwt.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: randomUUID(), iat: nowSeconds() })).toString(
      'base64url',
    );
    expect((await readMe(bearer(`${header}.${forged}.${signature}`))).status).toBe(401);
  });

  it('rejects an expired JWT', async () => {
    const expired = await signSelf({ iat: nowSeconds() - 7200, exp: nowSeconds() - 3600 });
    expect((await readMe(bearer(expired))).status).toBe(401);
  });

  it('rejects a JWT for another audience', async () => {
    const other = await signSelf({}, { jwt: { audience: 'https://other.example' } });
    expect((await readMe(bearer(other))).status).toBe(401);
  });

  it('rejects a JWT from an untrusted issuer', async () => {
    const other = await signSelf({}, { jwt: { issuer: 'https://evil.example' } });
    expect((await readMe(bearer(other))).status).toBe(401);
  });

  it('rejects a JWT whose subject is not a user', async () => {
    const stranger = await signSelf({ sub: randomUUID() });
    expect((await readMe(bearer(stranger))).status).toBe(401);
  });

  it('rejects a JWT without iat', async () => {
    const pair = await generateKeyPair('ES256');
    const unsigned = await new SignJWT({ sub: user.id })
      .setProtectedHeader({ alg: 'ES256' })
      .setIssuer(selfIssuer())
      .setAudience(selfIssuer())
      .setExpirationTime('5m')
      .sign(pair.privateKey);
    expect((await readMe(bearer(unsigned))).status).toBe(401);
  });
});

describe('JWTs from a configured external issuer', () => {
  const issuer = 'https://issuer.test';
  const audience = 'https://api.test';
  const kid = randomUUID();
  let user: User;
  let signingKey: CryptoKey;
  let jwksServer: ReturnType<typeof Bun.serve>;

  beforeAll(async () => {
    ({ entity: user } = await createUser());
    const pair = await generateKeyPair('ES256', { extractable: true });
    signingKey = pair.privateKey;
    const publicJwk = { ...(await exportJWK(pair.publicKey)), kid, alg: 'ES256', use: 'sig' };
    jwksServer = Bun.serve({ port: 0, fetch: () => Response.json({ keys: [publicJwk] }) });
  });

  afterAll(async () => {
    jwksServer.stop(true);
    await cleanupTouchedTables(db);
  });

  const configureIssuer = () => {
    setEnvOverride('AUTH_ISSUER', issuer);
    setEnvOverride('AUTH_AUDIENCE', audience);
    setEnvOverride('AUTH_JWKS_URL', `http://localhost:${jwksServer.port}/jwks`);
  };

  const signExternal = (claimedIssuer = issuer) =>
    new SignJWT({ sub: user.id })
      .setProtectedHeader({ alg: 'ES256', kid })
      .setIssuer(claimedIssuer)
      .setAudience(claimedIssuer === issuer ? audience : selfIssuer())
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(signingKey);

  it('accepts the issuer’s JWT through the same verification path', async () => {
    configureIssuer();
    expect((await readMe(bearer(await signExternal()))).status).toBe(200);
  });

  it('refuses the external key claiming to be this API', async () => {
    configureIssuer();
    expect((await readMe(bearer(await signExternal(selfIssuer())))).status).toBe(401);
  });

  it('refuses the issuer when it is not configured', async () => {
    expect((await readMe(bearer(await signExternal()))).status).toBe(401);
  });
});

describe('revocation: a new jwtVersion refuses every JWT signed with the old one', () => {
  let user: User;
  let superadmin: User;

  beforeAll(async () => {
    ({ entity: user } = await createUser());
    ({ entity: superadmin } = await createUser({ platformRole: PlatformRole.superadmin }));
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  const freshUser = async () => (await createUser()).entity;
  const reload = (target: User) => db.user.findUniqueOrThrow({ where: { id: target.id } });

  it('rotateUserJwts refuses the old JWT on the next request and a new JWT works', async () => {
    const target = await freshUser();
    const older = await createUserJwt(target);
    expect((await readMe(older)).status).toBe(200);
    await rotateUserJwts(target.id);
    expect((await readMe(older)).status).toBe(401);
    expect((await readMe(await createUserJwt(await reload(target)))).status).toBe(200);
  });

  it('a JWT without the version is refused', async () => {
    const { token } = await auth.api.signJWT({
      body: { payload: { sub: user.id, iat: nowSeconds() } },
    });
    expect((await readMe(bearer(token))).status).toBe(401);
  });

  it('a role change applies at once under the same JWT: permissions are not on the token', async () => {
    const target = await freshUser();
    const jwt = await createUserJwt(target);
    const { entity: organization } = await createOrganization();
    const { entity: membership } = await createOrganizationUser(
      { role: 'viewer' },
      { user: target, organization },
    );
    const rename = () =>
      app.request(`/api/v1/organization/${organization.id}`, {
        method: 'PATCH',
        headers: { ...jwt, 'content-type': 'application/json' },
        body: JSON.stringify({ name: `renamed-${randomUUID().slice(0, 6)}` }),
      });
    expect((await rename()).status).toBe(403);
    await db.organizationUser.update({ where: { id: membership.id }, data: { role: 'owner' } });
    expect((await rename()).status).toBe(200);
  });

  it('POST /me/rotateJwts ends every JWT of the caller', async () => {
    const jwt = await createUserJwt(await freshUser());
    const response = await app.request('/api/v1/me/rotateJwts', { method: 'POST', headers: jwt });
    expect(response.status).toBe(204);
    expect((await readMe(jwt)).status).toBe(401);
  });

  it("an API token cannot rotate its user's JWTs", async () => {
    const { authorization } = await createBearerToken(user);
    const response = await app.request('/api/v1/me/rotateJwts', {
      method: 'POST',
      headers: { authorization },
    });
    expect(response.status).toBe(403);
  });

  it("a superadmin rotates a user's JWTs", async () => {
    const target = await freshUser();
    const jwt = await createUserJwt(target);
    const response = await app.request(`/api/admin/user/${target.id}/rotateJwts`, {
      method: 'POST',
      headers: await createUserJwt(superadmin),
    });
    expect(response.status).toBe(204);
    expect((await readMe(jwt)).status).toBe(401);
  });

  it('a password reset revokes', async () => {
    const target = await freshUser();
    const jwt = await createUserJwt(target);
    await auth.options.emailAndPassword?.onPasswordReset?.({
      user: { ...target, name: target.name ?? '' },
    });
    expect((await readMe(jwt)).status).toBe(401);
  });

  it('a superadmin JWT spoofs, and the WebSocket identity follows the JWT', async () => {
    const admin = await createUserJwt(await reload(superadmin));
    const spoofed = await readMe({ ...admin, 'x-spoof-user-email': user.email });
    expect(((await spoofed.json()) as { data: { id: string } }).data.id).toBe(user.id);

    const identity = await resolveIdentity(admin);
    expect(identity).toMatchObject({ status: 'resolved', id: superadmin.id });
    await rotateUserJwts(superadmin.id);
    expect(await resolveIdentity(admin)).toEqual({ status: 'anonymous' });
  });
});

describe('account deletion revokes', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('redacting the account locks its JWTs out', async () => {
    const { entity: user } = await createUser();
    const jwt = await createUserJwt(user);
    const response = await app.request('/api/v1/me/redact', { method: 'POST', headers: jwt });
    expect(response.status).toBe(204);
    expect((await readMe(jwt)).status).toBe(401);
    expect(await db.user.findFirst({ where: { id: user.id } })).toBeNull();
  });
});
