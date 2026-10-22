import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { type AccessorName, db, fetchOne, type HydratedRecord, hydrate } from '@template/db';
import type { Integration, Organization, User } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createContact,
  createIntegration,
  createOrganization,
  createOrganizationUser,
  createUser,
} from '@template/db/test';
import { check, rebacSchema } from '@template/permissions/rebac';
import { auditActorMiddleware } from '#/middleware/auth/auditActorMiddleware';
import { jwtAuthMiddleware } from '#/middleware/auth/jwtAuthMiddleware';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { inquiryRouter } from '#/modules/inquiry';
import { integrationRouter } from '#/modules/integration';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { organizationUserRouter } from '#/modules/organizationUser';
import { createTestApp } from '#tests/createTestApp';
import { createBearerToken } from '#tests/utils/createBearerToken';
import { createUserJwt } from '#tests/utils/createUserJwt';

describe('holders: integrations, memberships and tokens hold permissions the same way', () => {
  let person: User;
  let otherPerson: User;
  let superadmin: User;
  let o1: Organization;
  let o2: Organization;
  let slackInO1: Integration;
  let githubInO1: Integration;
  let slackInO2: Integration;

  const app = createTestApp({
    mount: [
      (app) => {
        app.use('*', jwtAuthMiddleware);
        app.use('*', tokenAuthMiddleware);
        app.use('*', auditActorMiddleware);
        app.get('/api/v1/can/:model/:id/:action', async (c) => {
          const model = c.req.param('model') as AccessorName;
          const row = await fetchOne<HydratedRecord>(model, c.req.param('id'));
          if (!row) return c.json({ allowed: false }, 404);
          const record = await hydrate(model, row);
          return c.json({
            allowed: check(c.get('permix'), rebacSchema, model, record, c.req.param('action')),
          });
        });
        app.route('/api/v1/me', meRouter);
        app.route('/api/v1/organization', organizationRouter);
        app.route('/api/v1/organizationUser', organizationUserRouter);
        app.route('/api/v1/integration', integrationRouter);
        app.route('/api/v1/inquiry', inquiryRouter);
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

  const can = async (
    authorization: string,
    model: AccessorName,
    record: { id: string },
    action: string,
  ) => {
    const response = await call(authorization, 'GET', `/can/${model}/${record.id}/${action}`);
    expect(response.status).toBe(200);
    return ((await response.json()) as { allowed: boolean }).allowed;
  };

  const session = async (user: User) => (await createUserJwt(user)).authorization;

  const integrationToken = async (
    integration: Integration,
    overrides: Record<string, unknown> = {},
  ) =>
    (
      await createBearerToken(person, {
        ownerModel: 'Integration',
        userId: null,
        integrationId: integration.id,
        role: 'owner',
        ...overrides,
      })
    ).authorization;

  const userToken = async (overrides: Record<string, unknown> = {}, user: User = person) =>
    (await createBearerToken(user, { role: 'owner', ...overrides })).authorization;

  const listed = async (authorization: string, path: string) => {
    const response = await call(authorization, 'GET', path);
    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: { id: string }[] };
    return data.map((row) => row.id).sort();
  };

  const currentVersion = async (inquiryId: string) =>
    (await db.inquiry.findUniqueOrThrow({ where: { id: inquiryId } })).updatedAt.toISOString();

  const askGrant = (
    authorization: string,
    integration: Integration,
    target: User,
    content: Record<string, unknown>,
  ) =>
    call(authorization, 'POST', `/integration/${integration.id}/inquiries`, {
      type: 'grantUserEntitlements',
      targetModel: 'User',
      targetUserId: target.id,
      status: 'sent',
      content: { purpose: 'holders', role: 'viewer', ...content },
    });

  const approve = async (
    authorization: string,
    inquiryId: string,
    resolution: Record<string, unknown> = {},
  ) =>
    call(authorization, 'POST', `/inquiry/${inquiryId}/resolve`, {
      status: 'approved',
      expectedUpdatedAt: await currentVersion(inquiryId),
      ...resolution,
    });

  const approvedGrant = async (
    integration: Integration,
    content: Record<string, unknown>,
    target: User = person,
  ) => {
    const asked = await askGrant(await integrationToken(integration), integration, target, content);
    expect(asked.status).toBe(201);
    const { data } = (await asked.json()) as { data: { id: string } };
    expect((await approve(await session(target), data.id)).status).toBe(200);
    return data.id;
  };

  const grantJwt = async (inquiryId: string, user: User = person) =>
    (await createUserJwt(user, { grant: inquiryId })).authorization;

  const providerOwnerRule = {
    all: [
      { field: 'provider', operator: Operator.equals, value: { bind: 'self.provider' } },
      {
        field: 'organizationId',
        operator: Operator.equals,
        value: { bind: 'self.organizationId' },
      },
    ],
  };

  beforeAll(async () => {
    person = (await createUser()).entity;
    otherPerson = (await createUser()).entity;
    superadmin = (await createUser({ platformRole: 'superadmin' })).entity;
    o1 = (await createOrganization()).entity;
    o2 = (await createOrganization()).entity;
    await createOrganizationUser({ role: 'admin' }, { user: person, organization: o1 });
    await createOrganizationUser({ role: 'owner' }, { user: person, organization: o2 });
    await createOrganizationUser({ role: 'viewer' }, { user: otherPerson, organization: o1 });
    slackInO1 = (
      await createIntegration(
        { ownerModel: 'Organization', provider: 'slack', role: 'viewer' },
        { organization: o1 },
      )
    ).entity;
    githubInO1 = (
      await createIntegration(
        { ownerModel: 'Organization', provider: 'github', role: 'viewer' },
        { organization: o1 },
      )
    ).entity;
    slackInO2 = (
      await createIntegration(
        { ownerModel: 'Organization', provider: 'slack', role: 'viewer' },
        { organization: o2 },
      )
    ).entity;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  describe('an integration as the principal', () => {
    it('1. holds its role on its owner: a viewer reads the organization and does not manage it', async () => {
      const authorization = await integrationToken(slackInO1);
      expect(await can(authorization, 'organization', o1, 'read')).toBe(true);
      expect(await can(authorization, 'organization', o1, 'manage')).toBe(false);
      expect(await can(authorization, 'organization', o2, 'read')).toBe(false);
    });

    it('2. db:integration:self reaches itself and no sibling', async () => {
      const self = (
        await createIntegration(
          {
            ownerModel: 'Organization',
            provider: 'slack',
            role: 'viewer',
            entitlements: { 'db:integration:self': { manage: true } },
          },
          { organization: o1 },
        )
      ).entity;
      const authorization = await integrationToken(self);
      expect(await can(authorization, 'integration', self, 'manage')).toBe(true);
      expect(await can(authorization, 'integration', githubInO1, 'manage')).toBe(false);
      expect(await can(authorization, 'integration', githubInO1, 'read')).toBe(true);
    });

    it('3. a provider entitlement bound at creation owns the matching integrations of its organization only', async () => {
      const created = await call(
        await session(person),
        'POST',
        `/organization/${o1.id}/integrations`,
        {
          name: 'slack-owner',
          provider: 'slack',
          role: 'viewer',
          entitlements: { 'db:integration': { own: { rule: providerOwnerRule } } },
        },
      );
      expect(created.status).toBe(201);
      const { data: owner } = (await created.json()) as { data: Integration };
      expect(owner.entitlements).toEqual({
        'db:integration': {
          own: {
            rule: {
              all: [
                { field: 'provider', operator: Operator.equals, value: 'slack' },
                { field: 'organizationId', operator: Operator.equals, value: o1.id },
              ],
            },
          },
        },
      });
      const authorization = await integrationToken(owner);
      expect(await can(authorization, 'integration', slackInO1, 'own')).toBe(true);
      expect(await can(authorization, 'integration', githubInO1, 'own')).toBe(false);
      expect(await can(authorization, 'integration', slackInO2, 'own')).toBe(false);
    });

    it('4. the brand integration manages every integration of its organization through its role', async () => {
      const brand = (
        await createIntegration(
          { ownerModel: 'Organization', provider: 'slack', role: 'admin' },
          { organization: o1 },
        )
      ).entity;
      const authorization = await integrationToken(brand);
      expect(await can(authorization, 'integration', githubInO1, 'manage')).toBe(true);
      expect(await can(authorization, 'integration', slackInO1, 'manage')).toBe(true);
      expect(await can(authorization, 'integration', slackInO2, 'read')).toBe(false);
    });

    it('5. self arms never match an integration; it operates itself and names itself by db:integration:self', async () => {
      const membership = await db.organizationUser.findFirstOrThrow({
        where: { organizationId: o1.id, userId: otherPerson.id },
      });
      const authorization = await integrationToken(slackInO1);
      expect(await can(authorization, 'organizationUser', membership, 'leave')).toBe(false);
      expect(await can(authorization, 'integration', slackInO1, 'operate')).toBe(true);
      expect(await can(authorization, 'integration', slackInO1, 'manage')).toBe(false);
      expect(await can(authorization, 'integration', githubInO1, 'operate')).toBe(false);
    });
  });

  describe('memberships', () => {
    it('6. a role on the organization reaches its integrations by the walk', async () => {
      expect(await can(await session(person), 'integration', slackInO1, 'manage')).toBe(true);
      expect(await can(await session(otherPerson), 'integration', slackInO1, 'read')).toBe(true);
      expect(await can(await session(otherPerson), 'integration', slackInO1, 'manage')).toBe(false);
    });

    it('7. a membership entitlement on db:organization:self holds a custom action on that organization only', async () => {
      const member = (await createUser()).entity;
      await createOrganizationUser(
        { role: 'member', entitlements: { 'db:organization:self': { 'billing.view': true } } },
        { user: member, organization: o1 },
      );
      await createOrganizationUser({ role: 'member' }, { user: member, organization: o2 });
      const authorization = await session(member);
      expect(await can(authorization, 'organization', o1, 'billing.view')).toBe(true);
      expect(await can(authorization, 'organization', o2, 'billing.view')).toBe(false);
    });
  });

  describe('a token narrowing a user', () => {
    it('8. a key on db:organization lets in only the named organization; the role caps every anchor', async () => {
      const contactInO1 = (
        await createContact({ ownerModel: 'Organization' }, { organization: o1 })
      ).entity;
      const contactInO2 = (
        await createContact({ ownerModel: 'Organization' }, { organization: o2 })
      ).entity;
      const authorization = await userToken({
        role: 'viewer',
        entitlements: { [`db:organization:${o1.id}`]: { read: true } },
      });
      expect(await can(authorization, 'contact', contactInO1, 'read')).toBe(true);
      expect(await can(authorization, 'contact', contactInO2, 'read')).toBe(false);
      expect(await can(authorization, 'organization', o1, 'manage')).toBe(false);
    });

    it('9. no key on a resource means not narrowed there', async () => {
      const contactInO2 = (
        await createContact({ ownerModel: 'Organization' }, { organization: o2 })
      ).entity;
      const authorization = await userToken({ role: 'viewer' });
      expect(await can(authorization, 'contact', contactInO2, 'read')).toBe(true);
      expect(await can(authorization, 'contact', contactInO2, 'manage')).toBe(false);
    });

    it('10. a token on behalf of an integration is that integration, narrowed', async () => {
      const brand = (
        await createIntegration(
          { ownerModel: 'Organization', provider: 'slack', role: 'admin' },
          { organization: o1 },
        )
      ).entity;
      const narrowed = await integrationToken(brand, { role: 'viewer' });
      expect(await can(narrowed, 'integration', githubInO1, 'read')).toBe(true);
      expect(await can(narrowed, 'integration', githubInO1, 'manage')).toBe(false);
      const asking = await integrationToken(brand, { role: 'owner' });
      expect(await can(asking, 'organization', o1, 'own')).toBe(false);
    });

    it('11. an organization token is the organization; self arms never match it', async () => {
      const authorization = await userToken({
        ownerModel: 'Organization',
        userId: null,
        organizationId: o1.id,
        role: 'member',
      });
      expect(await can(authorization, 'organization', o1, 'operate')).toBe(true);
      expect(await can(authorization, 'organization', o1, 'manage')).toBe(false);
      const membership = await db.organizationUser.findFirstOrThrow({
        where: { organizationId: o1.id, userId: person.id },
      });
      expect(await can(authorization, 'organizationUser', membership, 'leave')).toBe(false);
    });
  });

  describe('self arms for users', () => {
    it('12. a session leaves its own membership and not another', async () => {
      const own = await db.organizationUser.findFirstOrThrow({
        where: { organizationId: o1.id, userId: person.id },
      });
      const other = await db.organizationUser.findFirstOrThrow({
        where: { organizationId: o1.id, userId: otherPerson.id },
      });
      expect(await can(await session(person), 'organizationUser', own, 'leave')).toBe(true);
      expect(await can(await session(otherPerson), 'organizationUser', own, 'leave')).toBe(false);
      expect(await can(await session(otherPerson), 'organizationUser', other, 'leave')).toBe(true);
    });

    it('13. a read-only user token cannot leave: self plus the action', async () => {
      const own = await db.organizationUser.findFirstOrThrow({
        where: { organizationId: o1.id, userId: person.id },
      });
      const authorization = await userToken({ role: 'viewer' });
      expect(await can(authorization, 'organizationUser', own, 'leave')).toBe(false);
    });

    it('14. a token holding operate on its user leaves', async () => {
      const own = await db.organizationUser.findFirstOrThrow({
        where: { organizationId: o1.id, userId: person.id },
      });
      const authorization = await userToken({ role: 'member' });
      expect(await can(authorization, 'organizationUser', own, 'leave')).toBe(true);
    });
  });

  describe('grants: an integration acting for a user', () => {
    it('15. a rule-valued entitlement narrows reads to matching rows the user reaches', async () => {
      const phone = (
        await createContact(
          { ownerModel: 'Organization', type: 'phone', value: { number: '+15555550100' } },
          { organization: o1 },
        )
      ).entity;
      const email = (await createContact({ ownerModel: 'Organization' }, { organization: o1 }))
        .entity;
      const foreignOrg = (await createOrganization()).entity;
      const foreignPhone = (
        await createContact(
          { ownerModel: 'Organization', type: 'phone', value: { number: '+15555550101' } },
          { organization: foreignOrg },
        )
      ).entity;
      const grantId = await approvedGrant(slackInO1, {
        entitlements: {
          'db:contact': {
            read: { rule: { field: 'type', operator: Operator.equals, value: 'phone' } },
          },
        },
      });
      const authorization = await grantJwt(grantId);
      expect(await can(authorization, 'contact', phone, 'read')).toBe(true);
      expect(await can(authorization, 'contact', email, 'read')).toBe(false);
      expect(await can(authorization, 'contact', foreignPhone, 'read')).toBe(false);
    });

    it('16. a grant never exceeds the user: manage asked where the user is a viewer denies', async () => {
      const viewer = (await createUser()).entity;
      const viewerOrg = (await createOrganization()).entity;
      await createOrganizationUser({ role: 'viewer' }, { user: viewer, organization: viewerOrg });
      const grantId = await approvedGrant(
        slackInO1,
        { role: 'owner', entitlements: { 'db:organization': { manage: true } } },
        viewer,
      );
      const authorization = await grantJwt(grantId, viewer);
      expect(await can(authorization, 'organization', viewerOrg, 'read')).toBe(true);
      expect(await can(authorization, 'organization', viewerOrg, 'manage')).toBe(false);
    });

    it('17. a revoked grant is a 401', async () => {
      const grantId = await approvedGrant(slackInO1, { entitlements: null });
      const authorization = await grantJwt(grantId);
      expect((await call(authorization, 'GET', '/me')).status).toBe(200);
      const revoked = await call(await session(person), 'POST', `/inquiry/${grantId}/revoke`, {
        expectedUpdatedAt: await currentVersion(grantId),
      });
      expect(revoked.status).toBe(204);
      expect((await call(authorization, 'GET', '/me')).status).toBe(401);
    });

    it("18. while acting for a user, the integration's own entitlements do not apply", async () => {
      const self = (
        await createIntegration(
          {
            ownerModel: 'Organization',
            provider: 'slack',
            role: 'admin',
            entitlements: { 'db:integration:self': { own: true } },
          },
          { organization: o1 },
        )
      ).entity;
      const grantId = await approvedGrant(self, { entitlements: null }, otherPerson);
      const authorization = await grantJwt(grantId, otherPerson);
      expect(await can(authorization, 'integration', self, 'own')).toBe(false);
      expect(await can(authorization, 'integration', self, 'manage')).toBe(false);
      expect(await can(authorization, 'integration', self, 'read')).toBe(true);
    });
  });

  describe('issuing', () => {
    it('19. a token never mints: token.create is in person only', async () => {
      const response = await call(await userToken({ role: 'owner' }), 'POST', '/me/tokens', {
        name: 'from-a-token',
        role: 'viewer',
      });
      expect(response.status).toBe(403);
    });

    it('20. a narrowing credential never widens: a token asking above its holder is stored at the holder', async () => {
      const viewer = (await createUser()).entity;
      const viewerOrg = (await createOrganization()).entity;
      const ownedOrg = (await createOrganization()).entity;
      await createOrganizationUser({ role: 'viewer' }, { user: viewer, organization: viewerOrg });
      await createOrganizationUser({ role: 'owner' }, { user: viewer, organization: ownedOrg });
      const response = await call(await session(viewer), 'POST', '/me/tokens', {
        name: 'asks-too-much',
        role: 'owner',
        entitlements: { [`db:organization:${viewerOrg.id}`]: { own: true } },
      });
      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: { key: string } };
      const authorization = `Bearer ${data.key}`;
      expect(await can(authorization, 'organization', viewerOrg, 'read')).toBe(true);
      expect(await can(authorization, 'organization', viewerOrg, 'own')).toBe(false);
      expect(await can(authorization, 'organization', ownedOrg, 'own')).toBe(false);
      expect(await can(await session(viewer), 'organization', ownedOrg, 'own')).toBe(true);
    });
  });

  describe('person-only and superadmin', () => {
    it('21. token.create passes for a session and for no token or grant', async () => {
      expect(await can(await session(person), 'user', person, 'token.create')).toBe(true);
      expect(await can(await userToken({ role: 'owner' }), 'user', person, 'token.create')).toBe(
        false,
      );
      const grantId = await approvedGrant(slackInO1, { entitlements: null });
      expect(await can(await grantJwt(grantId), 'user', person, 'token.create')).toBe(false);
    });

    it("22. a superadmin's session and a superadmin's token both pass everything", async () => {
      expect(await can(await session(superadmin), 'organization', o2, 'own')).toBe(true);
      const authorization = await userToken({ role: 'viewer' }, superadmin);
      expect(await can(authorization, 'organization', o2, 'own')).toBe(true);
      expect(await can(authorization, 'user', superadmin, 'token.create')).toBe(true);
    });
  });

  describe('lists', () => {
    it('23. a list returns exactly the rows check allows, as one where', async () => {
      const authorization = await userToken({
        role: 'owner',
        entitlements: {
          'db:integration': {
            read: { rule: { field: 'provider', operator: Operator.equals, value: 'slack' } },
          },
        },
      });
      expect(await listed(authorization, `/organization/${o1.id}/integrations`)).toEqual(
        (
          await db.integration.findMany({
            where: { organizationId: o1.id, provider: 'slack', deletedAt: null },
          })
        )
          .map((row) => row.id)
          .sort(),
      );
      expect(await can(authorization, 'integration', slackInO1, 'read')).toBe(true);
      expect(await can(authorization, 'integration', githubInO1, 'read')).toBe(false);
    });
  });

  describe('tokens on behalf of an integration', () => {
    it('24. reads what the integration reads, minus its own narrowing, never more', async () => {
      const self = (
        await createIntegration(
          {
            ownerModel: 'Organization',
            provider: 'slack',
            role: 'viewer',
            entitlements: { 'db:integration:self': { manage: true } },
          },
          { organization: o1 },
        )
      ).entity;
      const full = await integrationToken(self);
      expect(await can(full, 'integration', self, 'manage')).toBe(true);
      const narrowed = await integrationToken(self, {
        entitlements: { [`db:integration:${self.id}`]: { read: true } },
      });
      expect(await can(narrowed, 'integration', self, 'read')).toBe(true);
      expect(await can(narrowed, 'integration', self, 'manage')).toBe(false);
      expect(await can(narrowed, 'integration', githubInO1, 'read')).toBe(false);
    });

    it('25. a person mints a token on behalf of an integration it manages, capped at the integration', async () => {
      const response = await call(
        await session(person),
        'POST',
        `/integration/${slackInO1.id}/tokens`,
        {
          name: 'on-behalf',
          role: 'owner',
        },
      );
      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: { key: string } };
      const authorization = `Bearer ${data.key}`;
      expect(await can(authorization, 'organization', o1, 'read')).toBe(true);
      expect(await can(authorization, 'organization', o1, 'operate')).toBe(false);
      const refused = await call(
        await session(otherPerson),
        'POST',
        `/integration/${slackInO1.id}/tokens`,
        { name: 'not-mine', role: 'viewer' },
      );
      expect(refused.status).toBe(403);
    });
  });

  describe('write-time binding in inquiries', () => {
    it('26. $target and $source bind from the inquiry row; the stored grant holds real ids', async () => {
      const grantId = await approvedGrant(slackInO1, {
        role: 'admin',
        entitlements: {
          'db:user:$target': { read: true },
          'db:integration:$source': { manage: true },
          'db:integration': {
            read: {
              rule: {
                field: 'provider',
                operator: Operator.equals,
                value: { bind: 'source.provider' },
              },
            },
          },
        },
      });
      const inquiry = await db.inquiry.findUniqueOrThrow({ where: { id: grantId } });
      expect(
        (inquiry.resolution as { grant: { entitlements: unknown } }).grant.entitlements,
      ).toEqual({
        [`db:user:${person.id}`]: { read: true },
        [`db:integration:${slackInO1.id}`]: { manage: true },
        'db:integration': {
          read: { rule: { field: 'provider', operator: Operator.equals, value: 'slack' } },
        },
      });
      const authorization = await grantJwt(grantId);
      expect(await can(authorization, 'integration', slackInO1, 'manage')).toBe(true);
      expect(await can(authorization, 'integration', githubInO1, 'read')).toBe(false);
      expect(await can(authorization, 'integration', slackInO2, 'read')).toBe(true);
    });

    it('27. a literal id in a request, or a resolution naming another resource, is refused', async () => {
      const literal = await askGrant(await integrationToken(slackInO1), slackInO1, person, {
        entitlements: { [`db:integration:${githubInO1.id}`]: { manage: true } },
      });
      expect(literal.status).toBe(422);

      const asked = await askGrant(await integrationToken(slackInO1), slackInO1, person, {
        role: 'admin',
        entitlements: { 'db:integration:$source': { read: true, manage: true } },
      });
      expect(asked.status).toBe(201);
      const { data } = (await asked.json()) as { data: { id: string } };
      const redirected = await approve(await session(person), data.id, {
        entitlements: { [`db:integration:${githubInO1.id}`]: { manage: true } },
      });
      expect(redirected.status).toBe(422);
      const emptied = await approve(await session(person), data.id, { entitlements: {} });
      expect(emptied.status).toBe(422);
      const tightened = await approve(await session(person), data.id, {
        entitlements: { 'db:integration:$source': { read: true } },
      });
      expect(tightened.status).toBe(200);
      const authorization = await grantJwt(data.id);
      expect(await can(authorization, 'integration', slackInO1, 'read')).toBe(true);
      expect(await can(authorization, 'integration', slackInO1, 'manage')).toBe(false);
    });

    it('28. self binds on an integration resolve against its own row at creation, with no ids written by the caller', async () => {
      const created = await call(
        await session(person),
        'POST',
        `/organization/${o2.id}/integrations`,
        {
          name: 'slack-owner-o2',
          provider: 'slack',
          role: 'viewer',
          entitlements: { 'db:integration': { own: { rule: providerOwnerRule } } },
        },
      );
      expect(created.status).toBe(201);
      const { data: owner } = (await created.json()) as { data: Integration };
      const authorization = await integrationToken(owner);
      expect(await can(authorization, 'integration', slackInO2, 'own')).toBe(true);
      expect(await can(authorization, 'integration', slackInO1, 'own')).toBe(false);
      const literal = await call(
        await session(person),
        'POST',
        `/organization/${o2.id}/integrations`,
        {
          name: 'literal-ids',
          provider: 'slack',
          role: 'viewer',
          entitlements: {
            'db:integration': {
              own: { rule: { field: 'organizationId', operator: Operator.equals, value: o1.id } },
            },
          },
        },
      );
      expect(literal.status).toBe(422);
    });
  });

  describe('never more than the writer holds', () => {
    it('29. a stranger cannot give its own integration reach it does not hold', async () => {
      const stranger = (await createUser()).entity;
      const bare = await call(await session(stranger), 'POST', '/me/integrations', {
        name: 'owns-everything',
        role: 'owner',
        entitlements: { 'db:organization': { own: true } },
      });
      expect(bare.status).toBe(422);
      const named = await call(await session(stranger), 'POST', '/me/integrations', {
        name: 'owns-o2',
        role: 'owner',
        entitlements: { [`db:organization:${o2.id}`]: { own: true } },
      });
      expect(named.status).toBe(403);
    });

    it('30. an admin cannot hand a member keys the admin does not hold', async () => {
      const member = (await createUser()).entity;
      const { entity: membership } = await createOrganizationUser(
        { role: 'member' },
        { user: member, organization: o1 },
      );
      const everywhere = await call(
        await session(person),
        'PATCH',
        `/organizationUser/${membership.id}`,
        {
          entitlements: { 'db:organization': { own: true } },
        },
      );
      expect(everywhere.status).toBe(422);
      const above = await call(
        await session(person),
        'PATCH',
        `/organizationUser/${membership.id}`,
        {
          entitlements: { 'db:organization:self': { own: true } },
        },
      );
      expect(above.status).toBe(403);
      const within = await call(
        await session(person),
        'PATCH',
        `/organizationUser/${membership.id}`,
        {
          entitlements: { 'db:organization:self': { 'billing.view': true } },
        },
      );
      expect(within.status).toBe(403);
      const held = await call(
        await session(person),
        'PATCH',
        `/organizationUser/${membership.id}`,
        {
          entitlements: { 'db:organization:self': { manage: true } },
        },
      );
      expect(held.status).toBe(200);
      expect(await can(await session(member), 'organization', o1, 'manage')).toBe(true);
      expect(await can(await session(member), 'organization', o2, 'read')).toBe(false);
    });

    it("31. an admin cannot raise an integration's role above its own", async () => {
      const raised = await call(await session(person), 'PATCH', `/integration/${slackInO1.id}`, {
        role: 'owner',
      });
      expect(raised.status).toBe(403);
      const widened = await call(await session(person), 'PATCH', `/integration/${slackInO1.id}`, {
        entitlements: { [`db:organization:${o1.id}`]: { own: true } },
      });
      expect(widened.status).toBe(403);
    });

    it('32. an in-person action is never granted by entitlement', async () => {
      const response = await call(await session(person), 'POST', '/me/tokens', {
        name: 'mints-minting',
        role: 'owner',
        entitlements: { 'db:user:self': { 'token.create': true } },
      });
      expect(response.status).toBe(422);
    });

    it('33. a self key the holder cannot resolve denies instead of vanishing', async () => {
      const membership = await db.organizationUser.findFirstOrThrow({
        where: { organizationId: o1.id, userId: otherPerson.id },
      });
      const authorization = await userToken({
        role: 'owner',
        entitlements: { 'db:organizationUser:self': { read: true } },
      });
      expect(await can(authorization, 'organizationUser', membership, 'read')).toBe(false);
    });

    it('34. a list honours the rule on an id key', async () => {
      const authorization = await userToken({
        role: 'owner',
        entitlements: {
          [`db:integration:${githubInO1.id}`]: {
            read: { rule: { field: 'provider', operator: Operator.equals, value: 'slack' } },
          },
        },
      });
      expect(await listed(authorization, `/organization/${o1.id}/integrations`)).toEqual([]);
      expect(await can(authorization, 'integration', githubInO1, 'read')).toBe(false);
    });
  });
});
