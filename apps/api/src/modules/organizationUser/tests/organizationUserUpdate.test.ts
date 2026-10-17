import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { z } from '@hono/zod-openapi';
import type { Organization, OrganizationUser, User } from '@template/db/generated/client/client';
import { cleanupTouchedTables, createOrganizationUser } from '@template/db/test';
import { organizationUserRouter } from '#/modules/organizationUser';
import type { organizationUserUpdateRoute } from '#/modules/organizationUser/routes/organizationUserUpdate';
import { createTestApp } from '#tests/createTestApp';
import { json, patch } from '#tests/utils/request';

type UpdateOrgUserResponse = z.infer<typeof organizationUserUpdateRoute.responseSchema>;

describe('PATCH /api/v1/organizationUser/:id', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let org: Organization;
  let adminOrgUser: OrganizationUser;

  beforeAll(async () => {
    const { entity, context } = await createOrganizationUser({ role: 'admin' });
    adminOrgUser = entity;
    user = context.user;
    org = context.organization;

    const harness = createTestApp({
      mockUser: user,
      mockOrganizationUsers: [adminOrgUser],
      mount: [(app) => app.route('/api/v1/organizationUser', organizationUserRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('updates the role', async () => {
    const { entity: member } = await createOrganizationUser(
      { role: 'member' },
      { organization: org },
    );

    const response = await fetch(
      patch(`/api/v1/organizationUser/${member.id}`, { role: 'viewer' }),
    );
    const { data } = await json<UpdateOrgUserResponse>(response);

    expect(response.status).toBe(200);
    expect(data.role).toBe('viewer');
  });

  it('an admin cannot give a member a custom key it does not hold itself', async () => {
    const { entity: member } = await createOrganizationUser(
      { role: 'member' },
      { organization: org },
    );
    const response = await fetch(
      patch(`/api/v1/organizationUser/${member.id}`, { entitlements: { 'report.export': true } }),
    );
    expect(response.status).toBe(403);
  });

  it('an admin holding the key gives it', async () => {
    const { entity: holderMembership, context } = await createOrganizationUser(
      { role: 'admin', entitlements: { 'report.export': true } },
      { organization: org },
    );
    const holderFetch = createTestApp({
      mockUser: context.user,
      mockOrganizationUsers: [holderMembership],
      mount: [(app) => app.route('/api/v1/organizationUser', organizationUserRouter)],
    }).fetch;
    const { entity: member } = await createOrganizationUser(
      { role: 'member' },
      { organization: org },
    );
    const response = await holderFetch(
      patch(`/api/v1/organizationUser/${member.id}`, { entitlements: { 'report.export': true } }),
    );
    expect(response.status).toBe(200);
  });

  it('an admin cannot write owner- or admin-level entitlements, or assign itself', async () => {
    const { entity: member } = await createOrganizationUser(
      { role: 'member' },
      { organization: org },
    );
    for (const entitlements of [{ own: true }, { manage: true }, { assign: true }]) {
      const response = await fetch(
        patch(`/api/v1/organizationUser/${member.id}`, { entitlements }),
      );
      expect(response.status).toBe(403);
    }
  });

  it('an admin holding { assign } still cannot make someone an owner', async () => {
    const { entity: assignerMembership, context } = await createOrganizationUser(
      { role: 'admin', entitlements: { assign: true } },
      { organization: org },
    );
    const assignerFetch = createTestApp({
      mockUser: context.user,
      mockOrganizationUsers: [assignerMembership],
      mount: [(app) => app.route('/api/v1/organizationUser', organizationUserRouter)],
    }).fetch;
    const { entity: member } = await createOrganizationUser(
      { role: 'member' },
      { organization: org },
    );
    const response = await assignerFetch(
      patch(`/api/v1/organizationUser/${member.id}`, { role: 'owner' }),
    );
    expect(response.status).toBe(403);
  });
});
