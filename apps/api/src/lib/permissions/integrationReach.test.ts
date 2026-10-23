import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { db } from '@template/db';
import type { Integration, Organization, User } from '@template/db/generated/client/client';
import { auditActorContext } from '@template/db/lib/auditActorContext';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
  createUser,
} from '@template/db/test';
import { auditActorMiddleware } from '#/middleware/auth/auditActorMiddleware';
import { jwtAuthMiddleware } from '#/middleware/auth/jwtAuthMiddleware';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { inquiryRouter } from '#/modules/inquiry';
import { integrationRouter } from '#/modules/integration';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { tokenRouter } from '#/modules/token';
import { createTestApp } from '#tests/createTestApp';
import { createBearerToken } from '#tests/utils/createBearerToken';
import { createUserJwt } from '#tests/utils/createUserJwt';

type Reach = 'own' | 'none' | 'all' | 'listed';

describe('integration reach: what a credential may touch among its owner integrations', () => {
  let person: User;
  let otherPerson: User;
  let superadmin: User;
  let organization: Organization;
  let first: Integration;
  let second: Integration;
  let organizationIntegration: Integration;
  let foreign: Integration;

  const app = createTestApp({
    mount: [
      (app) => {
        app.use('*', jwtAuthMiddleware);
        app.use('*', tokenAuthMiddleware);
        app.use('*', auditActorMiddleware);
        app.get('/api/v1/audit-actor', (c) =>
          c.json({
            integrationId: auditActorContext.getScope()?.integrationId ?? null,
            actor: c.get('permix').getActor(),
          }),
        );
        app.get('/api/v1/permix-resources', (c) =>
          c.json(Object.keys(c.get('permix').getJSON() ?? {})),
        );
        app.route('/api/v1/me', meRouter);
        app.route('/api/v1/organization', organizationRouter);
        app.route('/api/v1/integration', integrationRouter);
        app.route('/api/v1/inquiry', inquiryRouter);
        app.route('/api/v1/token', tokenRouter);
      },
    ],
  });

  const call = (authorization: string, method: string, path: string, body?: unknown) =>
    app.fetch(
      new Request(`http://test/api/v1${path}`, {
        method,
        headers: { authorization, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );

  const personAuth = async (user: User) => (await createUserJwt(user)).authorization;

  const boundToken = async (
    integration: Integration,
    integrationReach: Reach,
    integrationReachIds: string[] = [],
    user: User = person,
  ) =>
    (
      await createBearerToken(user, {
        role: 'owner',
        integrationId: integration.id,
        integrationReach,
        integrationReachIds,
      })
    ).authorization;

  const reads = async (authorization: string, integration: Integration) =>
    (await call(authorization, 'GET', `/integration/${integration.id}`)).status;

  const renames = async (authorization: string, integration: Integration) =>
    (
      await call(authorization, 'PATCH', `/integration/${integration.id}`, {
        name: `renamed-${randomUUID().slice(0, 8)}`,
      })
    ).status;

  const listed = async (authorization: string, path: string) => {
    const response = await call(authorization, 'GET', path);
    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: { id: string }[] };
    return data.map((integration) => integration.id).sort();
  };

  const askGrant = (
    authorization: string,
    integration: Integration,
    target: User,
    content: Record<string, unknown> = {},
  ) =>
    call(authorization, 'POST', `/integration/${integration.id}/inquiries`, {
      type: 'grantUserEntitlements',
      targetModel: 'User',
      targetUserId: target.id,
      status: 'sent',
      content: {
        purpose: 'reach',
        entitlements: { read: true },
        entitlementsOnly: true,
        ...content,
      },
    });

  const currentVersion = async (inquiryId: string) =>
    (await db.inquiry.findUniqueOrThrow({ where: { id: inquiryId } })).updatedAt.toISOString();

  const approvedGrant = async (integration: Integration, content: Record<string, unknown> = {}) => {
    const asked = await askGrant(await personAuth(person), integration, person, content);
    expect(asked.status).toBe(201);
    const { data } = (await asked.json()) as { data: { id: string } };
    const resolved = await call(await personAuth(person), 'POST', `/inquiry/${data.id}/resolve`, {
      status: 'approved',
      expectedUpdatedAt: await currentVersion(data.id),
    });
    expect(resolved.status).toBe(200);
    return data.id;
  };

  beforeAll(async () => {
    person = (await createUser()).entity;
    otherPerson = (await createUser()).entity;
    superadmin = (await createUser({ platformRole: 'superadmin' })).entity;
    organization = (await createOrganization()).entity;
    await createOrganizationUser({ role: 'owner' }, { user: person, organization });
    first = (await createIntegration({ ownerModel: 'User' }, { user: person })).entity;
    second = (await createIntegration({ ownerModel: 'User' }, { user: person })).entity;
    organizationIntegration = (
      await createIntegration({ ownerModel: 'Organization' }, { organization })
    ).entity;
    foreign = (await createIntegration({ ownerModel: 'User' }, { user: otherPerson })).entity;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  describe('the actor each credential builds', () => {
    it('a person is a User actor reaching all', async () => {
      const response = await call(await personAuth(person), 'GET', '/audit-actor');
      expect(await response.json()).toEqual({
        integrationId: null,
        actor: {
          id: person.id,
          model: 'User',
          integrationId: null,
          integrationReach: 'all',
          integrationIds: [],
        },
      });
    });

    it('a bound token is a Token actor acting for its user; the audit origin is its integration', async () => {
      const response = await call(
        await boundToken(first, 'none'),
        'GET',
        '/audit-actor',
        undefined,
      );
      expect(await response.json()).toEqual({
        integrationId: first.id,
        actor: {
          id: person.id,
          model: 'Token',
          integrationId: first.id,
          integrationReach: 'listed',
          integrationIds: [],
        },
      });
    });

    it('an asserted x-integration-id never overrides the bound integration', async () => {
      const response = await app.fetch(
        new Request('http://test/api/v1/audit-actor', {
          headers: { authorization: await boundToken(first, 'all'), 'x-integration-id': second.id },
        }),
      );
      const body = (await response.json()) as { integrationId: string };
      expect(body.integrationId).toBe(first.id);
    });

    it('an asserted x-integration-id outside the credential reach is not the audit origin', async () => {
      const { authorization } = await createBearerToken(person, {
        role: 'owner',
        integrationReach: 'none',
      });
      const response = await app.fetch(
        new Request('http://test/api/v1/audit-actor', {
          headers: { authorization, 'x-integration-id': first.id },
        }),
      );
      expect(
        ((await response.json()) as { integrationId: string | null }).integrationId,
      ).toBeNull();
    });

    it('an organization token acts as itself: its id, never a user', async () => {
      const { token, authorization } = await createBearerToken(person, {
        ownerModel: 'Organization',
        userId: null,
        organizationId: organization.id,
        role: 'owner',
      });
      const response = await call(authorization, 'GET', '/audit-actor');
      const body = (await response.json()) as { actor: { id: string; model: string } };
      expect(body.actor).toMatchObject({ id: token.id, model: 'Token' });
    });
  });

  it('no credential is granted on db:integration directly, which would skip the fence', async () => {
    const organizationToken = await createBearerToken(person, {
      ownerModel: 'Organization',
      userId: null,
      organizationId: organization.id,
      role: 'owner',
    });
    const grantId = await approvedGrant(first, { integrationReach: 'own' });
    for (const authorization of [
      await personAuth(person),
      await boundToken(first, 'all'),
      organizationToken.authorization,
      `Bearer ${(await createUserJwt(person, { grant: grantId })).jwt}`,
    ]) {
      const response = await call(authorization, 'GET', '/permix-resources');
      const resources = (await response.json()) as string[];
      expect(resources.length).toBeGreaterThan(0);
      expect(resources.filter((resource) => resource.startsWith('db:integration'))).toEqual([]);
    }
  });

  describe('a person and an unbound token are unaffected', () => {
    it('a person reaches every integration its roles allow, and no other', async () => {
      const authorization = await personAuth(person);
      expect(await renames(authorization, first)).toBe(200);
      expect(await renames(authorization, organizationIntegration)).toBe(200);
      expect(await reads(authorization, foreign)).toBe(403);
      expect(await listed(authorization, '/me/integrations')).toEqual([first.id, second.id].sort());
    });

    it('a token minted without a reach stores all and reaches like its owner', async () => {
      const response = await call(await personAuth(person), 'POST', '/me/tokens', {
        name: 'unbound',
        role: 'owner',
      });
      expect(response.status).toBe(201);
      const { data } = (await response.json()) as {
        data: { key: string; integrationReach: string; integrationReachIds: string[] };
      };
      expect(data.integrationReach).toBe('all');
      expect(data.integrationReachIds).toEqual([]);
      expect(await renames(`Bearer ${data.key}`, second)).toBe(200);
    });
  });

  describe('a token bound to an integration', () => {
    it('none: touches no integration, not even its own, and creates none', async () => {
      const authorization = await boundToken(first, 'none');
      expect(await reads(authorization, first)).toBe(403);
      expect(await renames(authorization, second)).toBe(403);
      expect(await listed(authorization, '/me/integrations')).toEqual([]);
      expect(await listed(authorization, `/organization/${organization.id}/integrations`)).toEqual(
        [],
      );
      expect(
        (await call(authorization, 'POST', '/me/integrations', { name: `new-${randomUUID()}` }))
          .status,
      ).toBe(403);
      expect((await askGrant(authorization, first, otherPerson)).status).toBe(403);
    });

    it('own: its own integration, nothing else', async () => {
      const authorization = await boundToken(first, 'own');
      expect(await renames(authorization, first)).toBe(200);
      expect(await reads(authorization, second)).toBe(403);
      expect(await listed(authorization, '/me/integrations')).toEqual([first.id]);
      expect((await askGrant(authorization, first, otherPerson)).status).toBe(201);
    });

    it('listed: exactly the listed integrations', async () => {
      const authorization = await boundToken(first, 'listed', [
        second.id,
        organizationIntegration.id,
      ]);
      expect(await reads(authorization, first)).toBe(403);
      expect(await renames(authorization, second)).toBe(200);
      expect(await renames(authorization, organizationIntegration)).toBe(200);
      expect(await listed(authorization, '/me/integrations')).toEqual([second.id]);
      expect(await listed(authorization, `/organization/${organization.id}/integrations`)).toEqual([
        organizationIntegration.id,
      ]);
    });

    it('lists exactly what the check lets it read, in every mode', async () => {
      const owned = [first, second];
      for (const [reach, ids] of [
        ['none', []],
        ['own', []],
        ['listed', [second.id]],
        ['all', []],
      ] as const) {
        const authorization = await boundToken(first, reach, [...ids]);
        const readable: string[] = [];
        for (const integration of owned)
          if ((await reads(authorization, integration)) === 200) readable.push(integration.id);
        expect(await listed(authorization, '/me/integrations')).toEqual(readable.sort());
      }
    });

    it('all: every integration its roles allow, still none its roles deny', async () => {
      const authorization = await boundToken(first, 'all');
      expect(await renames(authorization, first)).toBe(200);
      expect(await renames(authorization, second)).toBe(200);
      expect(await reads(authorization, foreign)).toBe(403);
      expect(
        (await call(authorization, 'POST', '/me/integrations', { name: `new-${randomUUID()}` }))
          .status,
      ).toBe(201);
    });

    it('a superadmin skips the fence', async () => {
      const own = (await createIntegration({ ownerModel: 'User' }, { user: superadmin })).entity;
      const authorization = await boundToken(own, 'none', [], superadmin);
      expect(await reads(authorization, foreign)).toBe(200);
    });
  });

  describe('the reach a token is minted or changed with is checked', () => {
    const mint = async (body: Record<string, unknown>) =>
      call(await personAuth(person), 'POST', '/me/tokens', {
        name: 'reach',
        role: 'owner',
        ...body,
      });

    it('own needs a bound integration', async () => {
      expect((await mint({ integrationReach: 'own' })).status).toBe(422);
    });

    it('listed names at least one integration, all of the same owner', async () => {
      expect((await mint({ integrationReach: 'listed', integrationReachIds: [] })).status).toBe(
        422,
      );
      expect(
        (await mint({ integrationReach: 'listed', integrationReachIds: [foreign.id] })).status,
      ).toBe(422);
      const response = await mint({ integrationReach: 'listed', integrationReachIds: [first.id] });
      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: { integrationReachIds: string[] } };
      expect(data.integrationReachIds).toEqual([first.id]);
    });

    it('a user token may list its organization integrations', async () => {
      const response = await mint({
        integrationReach: 'listed',
        integrationReachIds: [organizationIntegration.id],
      });
      expect(response.status).toBe(201);
    });

    it('ids go only with listed', async () => {
      expect(
        (await mint({ integrationReach: 'all', integrationReachIds: [first.id] })).status,
      ).toBe(422);
    });

    it('an organization token lists only its organization integrations', async () => {
      const response = await call(
        await personAuth(person),
        'POST',
        `/organization/${organization.id}/tokens`,
        {
          name: 'org reach',
          role: 'admin',
          integrationReach: 'listed',
          integrationReachIds: [first.id],
        },
      );
      expect(response.status).toBe(422);
    });

    it('an update changes the reach, ids reset when it leaves listed', async () => {
      const { token } = await createBearerToken(person, { role: 'owner' });
      const narrowed = await call(await personAuth(person), 'PATCH', `/token/${token.id}`, {
        integrationReach: 'listed',
        integrationReachIds: [second.id],
      });
      expect(narrowed.status).toBe(200);
      const widened = await call(await personAuth(person), 'PATCH', `/token/${token.id}`, {
        integrationReach: 'all',
      });
      expect(widened.status).toBe(200);
      const stored = await db.token.findUniqueOrThrow({ where: { id: token.id } });
      expect(stored.integrationReach).toBe('all');
      expect(stored.integrationReachIds).toEqual([]);
    });
  });

  describe('a grant an integration asks for', () => {
    it('defaults to none: the grant JWT reaches no integration', async () => {
      const inquiryId = await approvedGrant(first);
      const inquiry = await db.inquiry.findUniqueOrThrow({ where: { id: inquiryId } });
      expect((inquiry.resolution as { grant: Record<string, unknown> }).grant).toMatchObject({
        integrationReach: 'none',
        integrationReachIds: [],
      });
      const authorization = `Bearer ${(await createUserJwt(person, { grant: inquiryId })).jwt}`;
      expect(await reads(authorization, first)).toBe(403);
      const actor = (await (await call(authorization, 'GET', '/audit-actor')).json()) as {
        integrationId: string;
        actor: { model: string };
      };
      expect(actor).toMatchObject({ integrationId: first.id, actor: { model: 'Inquiry' } });
    });

    it('own: the grant JWT reaches the integration that asked, nothing else', async () => {
      const inquiryId = await approvedGrant(first, { integrationReach: 'own' });
      const authorization = `Bearer ${(await createUserJwt(person, { grant: inquiryId })).jwt}`;
      expect(await reads(authorization, first)).toBe(200);
      expect(await reads(authorization, second)).toBe(403);
    });

    it('lists only integrations of the user the grant acts as', async () => {
      const asked = await askGrant(await personAuth(person), first, person, {
        integrationReach: 'listed',
        integrationReachIds: [foreign.id],
      });
      expect(asked.status).toBe(422);
      const inquiryId = await approvedGrant(first, {
        integrationReach: 'listed',
        integrationReachIds: [second.id],
      });
      const authorization = `Bearer ${(await createUserJwt(person, { grant: inquiryId })).jwt}`;
      expect(await reads(authorization, second)).toBe(200);
      expect(await reads(authorization, first)).toBe(403);
    });

    it('a grant a person asks for itself stays unbound and reaches all', async () => {
      const asked = await call(await personAuth(person), 'POST', '/me/inquiries', {
        type: 'grantUserEntitlements',
        targetModel: 'User',
        targetUserId: person.id,
        status: 'sent',
        content: { purpose: 'self', entitlements: { read: true }, entitlementsOnly: true },
      });
      expect(asked.status).toBe(201);
      const { data } = (await asked.json()) as { data: { id: string } };
      const authorization = `Bearer ${(await createUserJwt(person, { grant: data.id })).jwt}`;
      expect(await reads(authorization, second)).toBe(200);
    });

    it('revoking through the asking integration needs reach on it', async () => {
      const asked = await askGrant(await personAuth(person), first, otherPerson);
      const { data } = (await asked.json()) as { data: { id: string } };
      const resolved = await call(
        await personAuth(otherPerson),
        'POST',
        `/inquiry/${data.id}/resolve`,
        { status: 'approved', expectedUpdatedAt: await currentVersion(data.id) },
      );
      expect(resolved.status).toBe(200);
      const revoke = async (authorization: string) =>
        (
          await call(authorization, 'POST', `/inquiry/${data.id}/revoke`, {
            expectedUpdatedAt: await currentVersion(data.id),
          })
        ).status;
      expect(await revoke(await boundToken(first, 'none'))).toBe(403);
      expect(await revoke(await boundToken(first, 'own'))).toBe(204);
    });
  });
});
