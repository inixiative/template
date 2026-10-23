import { afterAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { User } from '@template/db/generated/client/client';
import { IntegrationOwnerModel } from '@template/db/generated/client/enums';
import { auditActorContext } from '@template/db/lib/auditActorContext';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
  createUser,
} from '@template/db/test';
import { setUserContext } from '#/lib/context/setUserContext';
import { auditActorMiddleware } from '#/middleware/auth/auditActorMiddleware';
import { spoofMiddleware } from '#/middleware/auth/spoofMiddleware';
import { findUserWithRelations } from '#/modules/user/services/find';
import { createTestApp } from '#tests/createTestApp';

type Echo = { integrationId: string | null; actorUserId: string | null };

const buildApp = (user: User) =>
  createTestApp({
    mount: [
      (app) => {
        app.use('*', async (c, next) => {
          const found = await findUserWithRelations(user.id);
          if (found) await setUserContext(c, found);
          await next();
        });
        app.use('*', spoofMiddleware);
        app.use('*', auditActorMiddleware);
        app.get('/echo', (c) => {
          const actor = auditActorContext.getScope();
          return c.json({
            integrationId: actor?.integrationId ?? null,
            actorUserId: actor?.actorUserId ?? null,
          });
        });
      },
    ],
  });

const echo = async (user: User, headers: Record<string, string>) => {
  const res = await buildApp(user).fetch(new Request('http://test/echo', { headers }));
  expect(res.status).toBe(200);
  return (await res.json()) as Echo;
};

describe('auditActorMiddleware x-integration-id', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('carries an integration the caller owns', async () => {
    const { entity: owner, context } = await createUser();
    const { entity: integration } = await createIntegration(
      { ownerModel: IntegrationOwnerModel.User, userId: owner.id },
      context,
    );

    const body = await echo(owner, { 'x-integration-id': integration.id });

    expect(body.integrationId).toBe(integration.id);
  });

  it('ignores a superadmin asserting an integration they do not own', async () => {
    const { entity: admin } = await createUser({ platformRole: 'superadmin' });
    const { entity: owner, context } = await createUser();
    const { entity: integration } = await createIntegration(
      { ownerModel: IntegrationOwnerModel.User, userId: owner.id },
      context,
    );

    const body = await echo(admin, { 'x-integration-id': integration.id });

    expect(body.actorUserId).toBe(admin.id);
    expect(body.integrationId).toBeNull();
  });

  it("ignores an organization member asserting another member's integration", async () => {
    const { entity: organization } = await createOrganization();
    const { entity: member } = await createUser();
    const { entity: otherMember } = await createUser();
    await createOrganizationUser({ role: 'admin' }, { user: member, organization });
    const { entity: otherMembership } = await createOrganizationUser(
      { role: 'member' },
      { user: otherMember, organization },
    );
    const { entity: integration } = await createIntegration(
      { ownerModel: IntegrationOwnerModel.OrganizationUser },
      { user: otherMember, organization, organizationUser: otherMembership },
    );

    const body = await echo(member, { 'x-integration-id': integration.id });

    expect(body.integrationId).toBeNull();
  });

  it('carries the spoofed user integration for a spoofing superadmin', async () => {
    const { entity: admin } = await createUser({ platformRole: 'superadmin' });
    const { entity: owner, context } = await createUser();
    const { entity: integration } = await createIntegration(
      { ownerModel: IntegrationOwnerModel.User, userId: owner.id },
      context,
    );

    const body = await echo(admin, {
      'x-spoof-user-email': owner.email,
      'x-integration-id': integration.id,
    });

    expect(body.integrationId).toBe(integration.id);
  });
});
