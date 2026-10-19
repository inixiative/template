import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { clearHookRegistry, db } from '@template/db';
import type { Organization, User } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
  createUser,
} from '@template/db/test';
import type { Entitlements } from '@template/permissions/client';
import { setEnvOverride } from '@template/shared/utils';
import { exportJWK, generateKeyPair, type JWTPayload, SignJWT } from 'jose';
import { registerAuditLogHook } from '#/hooks/auditLog/hook';
import { auditActorMiddleware } from '#/middleware/auth/auditActorMiddleware';
import { jwtAuthMiddleware } from '#/middleware/auth/jwtAuthMiddleware';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { inquiryRouter } from '#/modules/inquiry';
import { integrationRouter } from '#/modules/integration';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { createTestApp } from '#tests/createTestApp';

registerAuditLogHook();

const issuer = 'https://issuer.test';
const audience = 'https://api.test';

describe('JWT from a configured issuer, with and without a grant', () => {
  let user: User;
  let otherUser: User;
  let ownedOrganization: Organization;
  let viewedOrganization: Organization;
  let jwksServer: ReturnType<typeof Bun.serve>;
  let signingKey: CryptoKey;
  let strangerKey: CryptoKey;
  const kid = randomUUID();

  const app = createTestApp({
    mount: [
      (app) => {
        app.use('*', jwtAuthMiddleware);
        app.use('*', tokenAuthMiddleware);
        app.use('*', auditActorMiddleware);
        app.route('/api/v1/me', meRouter);
        app.route('/api/v1/organization', organizationRouter);
        app.route('/api/v1/inquiry', inquiryRouter);
        app.route('/api/v1/integration', integrationRouter);
      },
    ],
  });

  const sign = (
    claims: JWTPayload,
    options: {
      key?: CryptoKey;
      kid?: string;
      issuer?: string;
      audience?: string;
      exp?: string;
    } = {},
  ) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'ES256', kid: options.kid ?? kid })
      .setIssuer(options.issuer ?? issuer)
      .setAudience(options.audience ?? audience)
      .setSubject((claims.sub as string | undefined) ?? user.id)
      .setIssuedAt()
      .setExpirationTime(options.exp ?? '5m')
      .sign(options.key ?? signingKey);

  const call = (jwt: string, method: string, path: string, body?: unknown) =>
    app.fetch(
      new Request(`http://test/api/v1${path}`, {
        method,
        headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );

  const currentVersion = async (inquiryId: string) =>
    (await db.inquiry.findUniqueOrThrow({ where: { id: inquiryId } })).updatedAt.toISOString();

  const rename = (jwt: string, organization: Organization) =>
    call(jwt, 'PATCH', `/organization/${organization.id}`, {
      name: `renamed-${randomUUID().slice(0, 6)}`,
    });

  const requestGrant = async (
    jwt: string,
    content: { role?: string; entitlements?: Entitlements; entitlementsOnly?: boolean },
  ) =>
    call(jwt, 'POST', '/me/inquiries', {
      type: 'grantUserEntitlements',
      targetModel: 'User',
      targetUserId: user.id,
      status: 'sent',
      content: { purpose: 'artifactory', ...content },
    });

  const grantJwt = async (content: Parameters<typeof requestGrant>[1]) => {
    const response = await requestGrant(await sign({}), content);
    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: { id: string; status: string } };
    expect(data.status).toBe('approved');
    return { jwt: await sign({ grant: data.id }), inquiryId: data.id };
  };

  beforeAll(async () => {
    user = (await createUser()).entity;
    otherUser = (await createUser()).entity;
    ownedOrganization = (await createOrganization()).entity;
    viewedOrganization = (await createOrganization()).entity;
    await createOrganizationUser({ role: 'owner' }, { user, organization: ownedOrganization });
    await createOrganizationUser({ role: 'viewer' }, { user, organization: viewedOrganization });

    const pair = await generateKeyPair('ES256', { extractable: true });
    signingKey = pair.privateKey;
    strangerKey = (await generateKeyPair('ES256')).privateKey;
    const jwk = { ...(await exportJWK(pair.publicKey)), kid, alg: 'ES256', use: 'sig' };
    jwksServer = Bun.serve({ port: 0, fetch: () => Response.json({ keys: [jwk] }) });
  });

  beforeEach(() => {
    setEnvOverride('AUTH_ISSUER', issuer);
    setEnvOverride('AUTH_AUDIENCE', audience);
    setEnvOverride('AUTH_JWKS_URL', `http://localhost:${jwksServer.port}/jwks`);
  });

  afterAll(async () => {
    jwksServer.stop(true);
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  describe('verification', () => {
    it('accepts a valid JWT as the user', async () => {
      const response = await call(await sign({}), 'GET', '/me');
      expect(response.status).toBe(200);
      const { data } = (await response.json()) as { data: { id: string } };
      expect(data.id).toBe(user.id);
    });

    it('refuses a wrong issuer, a wrong audience, an expired token', async () => {
      expect(
        (await call(await sign({}, { issuer: 'https://evil.test' }), 'GET', '/me')).status,
      ).toBe(401);
      expect(
        (await call(await sign({}, { audience: 'https://evil.test' }), 'GET', '/me')).status,
      ).toBe(401);
      expect((await call(await sign({}, { exp: '-2m' }), 'GET', '/me')).status).toBe(401);
    });

    it('refuses a bad signature and an unknown key', async () => {
      expect((await call(await sign({}, { key: strangerKey }), 'GET', '/me')).status).toBe(401);
      expect(
        (await call(await sign({}, { key: strangerKey, kid: randomUUID() }), 'GET', '/me')).status,
      ).toBe(401);
    });

    it('refuses alg none and HS256', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
      const body = Buffer.from(
        JSON.stringify({ sub: user.id, iss: issuer, aud: audience, exp: Date.now() / 1000 + 300 }),
      ).toString('base64url');
      expect((await call(`${header}.${body}.x`, 'GET', '/me')).status).toBe(401);
      const hs256 = await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer(issuer)
        .setAudience(audience)
        .setSubject(user.id)
        .setExpirationTime('5m')
        .sign(new TextEncoder().encode('a-shared-secret-of-enough-length-000'));
      expect((await call(hs256, 'GET', '/me')).status).toBe(401);
    });

    it('refuses a subject with no user', async () => {
      expect((await call(await sign({ sub: randomUUID() }), 'GET', '/me')).status).toBe(401);
    });

    it('answers 503 when the issuer keys are unreachable', async () => {
      const closed = Bun.serve({ port: 0, fetch: () => new Response('') });
      const port = closed.port;
      closed.stop(true);
      setEnvOverride('AUTH_JWKS_URL', `http://localhost:${port}/jwks`);
      expect((await call(await sign({}), 'GET', '/me')).status).toBe(503);
    });

    it('is refused when its issuer is not configured', async () => {
      setEnvOverride('AUTH_ISSUER', undefined);
      expect((await call(await sign({}), 'GET', '/me')).status).toBe(401);
    });
  });

  describe('a JWT with no grant is the full user', () => {
    it('acts as the full user, token minting included', async () => {
      const jwt = await sign({});
      expect((await rename(jwt, ownedOrganization)).status).toBe(200);
      expect((await rename(jwt, viewedOrganization)).status).toBe(403);
      expect(
        (await call(jwt, 'POST', '/me/tokens', { name: 'minted', role: 'viewer' })).status,
      ).toBe(201);
    });

    it('an audited write records the user as the actor and no token', async () => {
      const name = `jwt-write-${randomUUID().slice(0, 6)}`;
      const response = await call(
        await sign({}),
        'PATCH',
        `/organization/${ownedOrganization.id}`,
        {
          name,
        },
      );
      expect(response.status).toBe(200);
      const log = await db.auditLog.findFirst({
        where: { subjectOrganizationId: ownedOrganization.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(log?.actorUserId).toBe(user.id);
      expect(log?.actorTokenId).toBeNull();
    });
  });

  describe('a scoped JWT carries approved entitlements', () => {
    it('entitlement-only { read }: reads, writes nothing, mints nothing', async () => {
      const { jwt } = await grantJwt({ entitlements: { read: true }, entitlementsOnly: true });
      expect((await call(jwt, 'GET', '/me')).status).toBe(200);
      expect((await call(jwt, 'GET', `/organization/${ownedOrganization.id}/users`)).status).toBe(
        200,
      );
      expect((await rename(jwt, ownedOrganization)).status).toBe(403);
      expect((await call(jwt, 'POST', '/me/tokens', { name: 'm', role: 'viewer' })).status).toBe(
        403,
      );
      expect(
        (
          await call(jwt, 'POST', '/me/contacts', {
            type: 'linkedin',
            value: { url: 'https://x.test/a' },
          })
        ).status,
      ).toBe(403);
    });

    it('a read-only grant cannot ask for a wider one', async () => {
      const { jwt } = await grantJwt({ entitlements: { read: true }, entitlementsOnly: true });
      expect((await requestGrant(jwt, { role: 'owner' })).status).toBe(403);
    });

    it('default mode viewer + { manage }: capped by each membership', async () => {
      const { jwt } = await grantJwt({ role: 'viewer', entitlements: { manage: true } });
      expect((await rename(jwt, ownedOrganization)).status).toBe(200);
      expect((await rename(jwt, viewedOrganization)).status).toBe(403);
    });

    it('a grant naming token.create still cannot mint (Aron, 2026-10-18)', async () => {
      const { jwt } = await grantJwt({
        entitlements: { read: true, 'token.create': true },
        entitlementsOnly: true,
      });
      expect(
        (
          await call(jwt, 'POST', '/me/tokens', {
            name: 'm',
            role: 'viewer',
            entitlements: { read: true },
          })
        ).status,
      ).toBe(403);
    });

    it('the user cannot be asked for an action they do not hold', async () => {
      const response = await requestGrant(await sign({}), {
        entitlements: { 'artifact.create': true },
        entitlementsOnly: true,
      });
      expect(response.status).toBe(422);
    });

    it('revoking the inquiry kills the JWT', async () => {
      const { jwt, inquiryId } = await grantJwt({
        entitlements: { read: true },
        entitlementsOnly: true,
      });
      expect((await call(jwt, 'GET', '/me')).status).toBe(200);
      expect(
        (
          await call(await sign({}), 'POST', `/inquiry/${inquiryId}/revoke`, {
            expectedUpdatedAt: await currentVersion(inquiryId),
          })
        ).status,
      ).toBe(204);
      expect((await call(jwt, 'GET', '/me')).status).toBe(401);
    });

    it('a grant for another user does not apply', async () => {
      const { inquiryId } = await grantJwt({
        entitlements: { read: true },
        entitlementsOnly: true,
      });
      expect(
        (await call(await sign({ sub: otherUser.id, grant: inquiryId }), 'GET', '/me')).status,
      ).toBe(401);
    });
  });

  describe('issuing is capped by the principal that issues', () => {
    it('a { member, token.create } grant asking for an owner grant waits for the user', async () => {
      const { jwt } = await grantJwt({ role: 'member', entitlements: { 'token.create': true } });
      const response = await requestGrant(jwt, {
        role: 'owner',
        entitlements: { 'token.create': true, 'user.redact': true },
      });
      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: { id: string; status: string } };
      expect(data.status).toBe('sent');
      expect(
        (
          await call(jwt, 'POST', `/inquiry/${data.id}/resolve`, {
            status: 'approved',
            expectedUpdatedAt: await currentVersion(data.id),
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await call(await sign({}), 'POST', `/inquiry/${data.id}/resolve`, {
            status: 'approved',
            expectedUpdatedAt: await currentVersion(data.id),
          })
        ).status,
      ).toBe(200);
    });

    it('a token holding no session action cannot self-approve them through its own integration', async () => {
      const { entity: integration } = await createIntegration({ ownerModel: 'User' }, { user });
      const { jwt } = await grantJwt({ role: 'admin' });
      const response = await call(jwt, 'POST', `/integration/${integration.id}/inquiries`, {
        type: 'grantUserEntitlements',
        targetModel: 'User',
        targetUserId: user.id,
        status: 'sent',
        content: { purpose: 'escalate', role: 'owner', entitlements: { 'token.create': true } },
      });
      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: { status: string } };
      expect(data.status).toBe('sent');
    });

    it('an org admin cannot act through a member-owned integration; an org owner asks but cannot auto-approve', async () => {
      const admin = (await createUser()).entity;
      await createOrganizationUser(
        { role: 'admin' },
        { user: admin, organization: viewedOrganization },
      );
      const orgOwner = (await createUser()).entity;
      await createOrganizationUser(
        { role: 'owner' },
        { user: orgOwner, organization: viewedOrganization },
      );
      const memberMembership = await db.organizationUser.findFirstOrThrow({
        where: { userId: user.id, organizationId: viewedOrganization.id },
      });
      const { entity: integration } = await createIntegration(
        { ownerModel: 'OrganizationUser' },
        { user, organization: viewedOrganization, organizationUser: memberMembership },
      );
      const ask = async (sub: string) =>
        call(await sign({ sub }), 'POST', `/integration/${integration.id}/inquiries`, {
          type: 'grantUserEntitlements',
          targetModel: 'User',
          targetUserId: user.id,
          status: 'sent',
          content: { purpose: 'takeover', role: 'owner', entitlements: { 'token.create': true } },
        });
      expect((await ask(admin.id)).status).toBe(403);
      const response = await ask(orgOwner.id);
      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: { status: string } };
      expect(data.status).toBe('sent');
    });
  });

  describe('an integration asks for entitlements', () => {
    it('waits for the user when the integration is not theirs, and applies once approved', async () => {
      const { entity: integration, context } = await createIntegration(
        { ownerModel: 'User' },
        { user: otherUser },
      );
      expect(context.user?.id).toBe(otherUser.id);
      const asIntegrationOwner = await sign({ sub: otherUser.id });
      const response = await call(
        asIntegrationOwner,
        'POST',
        `/integration/${integration.id}/inquiries`,
        {
          type: 'grantUserEntitlements',
          targetModel: 'User',
          targetUserId: user.id,
          status: 'sent',
          content: { purpose: 'artifactory', entitlements: { read: true }, entitlementsOnly: true },
        },
      );
      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: { id: string; status: string } };
      expect(data.status).toBe('sent');

      const grantJwtBefore = await sign({ grant: data.id });
      expect((await call(grantJwtBefore, 'GET', '/me')).status).toBe(401);

      const resolved = await call(await sign({}), 'POST', `/inquiry/${data.id}/resolve`, {
        expectedUpdatedAt: await currentVersion(data.id),
        status: 'approved',
      });
      expect(resolved.status).toBe(200);
      expect((await call(grantJwtBefore, 'GET', '/me')).status).toBe(200);
    });

    it('does not auto-approve, even for an integration the user owns', async () => {
      const { entity: integration } = await createIntegration({ ownerModel: 'User' }, { user });
      const response = await call(
        await sign({}),
        'POST',
        `/integration/${integration.id}/inquiries`,
        {
          type: 'grantUserEntitlements',
          targetModel: 'User',
          targetUserId: user.id,
          status: 'sent',
          content: { purpose: 'artifactory', entitlements: { read: true }, entitlementsOnly: true },
        },
      );
      const { data } = (await response.json()) as { data: { status: string } };
      expect(data.status).toBe('sent');
    });
  });
});
