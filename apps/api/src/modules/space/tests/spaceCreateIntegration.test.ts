import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type {
  Integration,
  Organization,
  OrganizationUser,
  Space,
  SpaceUser,
  User,
} from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
  createProject,
  createProjectIntegration,
  createSpace,
  createSpaceUser,
  createUser,
  nextFactorySequenceNumber,
} from '@template/db/test';
import { INTEGRATION_ONE_PER } from '@template/shared/integrations/integrationOnePer';
import { spaceRouter } from '#/modules/space';
import { createTestApp } from '#tests/createTestApp';
import { parseSuccessBody, post } from '#tests/utils/request';

describe('POST /api/v1/space/:id/integrations', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let admin: User;
  let org: Organization;
  let adminOu: OrganizationUser;
  let space: Space;
  let adminSu: SpaceUser;

  beforeEach(async () => {
    const { entity: u } = await createUser();
    admin = u;
    const { entity: o } = await createOrganization();
    org = o;
    const { entity: ou, context: ouCtx } = await createOrganizationUser(
      { role: 'owner' },
      { user: admin, organization: org },
    );
    adminOu = ou;
    const { entity: s } = await createSpace({}, { organization: org });
    space = s;
    const { entity: su } = await createSpaceUser({ role: 'owner' }, { ...ouCtx, space });
    adminSu = su;

    const harness = createTestApp({
      mockUser: admin,
      mockOrganizationUsers: [adminOu],
      mockSpaceUsers: [adminSu],
      mount: [(app) => app.route('/api/v1/space', spaceRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it("creates a space-owned integration carrying the space's organizationId", async () => {
    const response = await fetch(
      post(`/api/v1/space/${space.id}/integrations`, {
        name: `Space Integration ${nextFactorySequenceNumber()}`,
        role: 'viewer',
      }),
    );
    const { data } = await parseSuccessBody<Integration>(response);
    expect(response.status).toBe(201);
    expect(data.ownerModel).toBe('Space');
    expect(data.spaceId).toBe(space.id);
    expect(data.organizationId).toBe(org.id);
  });

  it('connecting a one-per-owner provider again revives the removed integration with what was removed with it, and over a live one updates it', async () => {
    INTEGRATION_ONE_PER.linear = ['owner'];
    const connect = () =>
      fetch(
        post(`/api/v1/space/${space.id}/integrations`, {
          name: 'Linear',
          role: 'viewer',
          provider: 'linear',
        }),
      );
    try {
      const { data: first } = await parseSuccessBody<Integration>(await connect());
      const { entity: project } = await createProject({
        ownerModel: 'Space',
        organizationId: org.id,
        spaceId: space.id,
      });
      await createProjectIntegration({}, { project, integration: first });
      await db.integration.update({ where: { id: first.id }, data: { deletedAt: new Date() } });

      const again = await connect();
      const { data: revived } = await parseSuccessBody<Integration>(again);
      expect(again.status).toBe(201);
      expect(revived).toMatchObject({ id: first.id, deletedAt: null });
      expect(await db.projectIntegration.count({ where: { integrationId: first.id } })).toBe(1);
      const { data: refreshed } = await parseSuccessBody<Integration>(await connect());
      expect(refreshed.id).toBe(first.id);
    } finally {
      delete INTEGRATION_ONE_PER.linear;
    }
  });

  it('refuses to revive a one-per-project integration whose project has since linked another of that provider', async () => {
    INTEGRATION_ONE_PER.linear = ['owner', 'project'];
    const connect = () =>
      fetch(
        post(`/api/v1/space/${space.id}/integrations`, {
          name: 'Linear',
          role: 'viewer',
          provider: 'linear',
        }),
      );
    try {
      const { data: first } = await parseSuccessBody<Integration>(await connect());
      const { entity: project } = await createProject({
        ownerModel: 'Space',
        organizationId: org.id,
        spaceId: space.id,
      });
      await createProjectIntegration({}, { project, integration: first });
      await db.integration.update({ where: { id: first.id }, data: { deletedAt: new Date() } });
      const { entity: other } = await createIntegration({
        ownerModel: 'Organization',
        organizationId: org.id,
        provider: 'linear',
      });
      await createProjectIntegration({}, { project, integration: other });

      expect((await connect()).status).toBe(409);
      const stillRemoved = await db.withDeleted(() =>
        db.integration.findUniqueOrThrow({ where: { id: first.id } }),
      );
      expect(stillRemoved.deletedAt).not.toBeNull();
    } finally {
      delete INTEGRATION_ONE_PER.linear;
    }
  });
});
