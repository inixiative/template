import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Organization, OrganizationUser, User } from '@template/db';
import { cleanupTouchedTables, createOrganizationUser, createToken } from '@template/db/test';
import { tokenRouter } from '#/modules/token';
import { createTestApp } from '#tests/createTestApp';
import { del } from '#tests/utils/request';

describe('DELETE /token/:id', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let org: Organization;
  let orgUser: OrganizationUser;

  beforeAll(async () => {
    const { entity, context } = await createOrganizationUser({ role: 'admin' });
    orgUser = entity;
    user = context.User;
    org = context.Organization;

    const harness = createTestApp({
      mockUser: user,
      mount: [(app) => app.route('/api/v1/token', tokenRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('deletes a User token', async () => {
    const { entity: token } = await createToken({ ownerModel: 'User' }, { User: user });

    const response = await fetch(del(`/api/v1/token/${token.id}`));
    expect(response.status).toBe(204);

    const deleted = await db.token.findUnique({ where: { id: token.id } });
    expect(deleted).toBeNull();
  });

  it('deletes an Organization token', async () => {
    const { entity: token } = await createToken({ ownerModel: 'Organization' }, { Organization: org });

    const response = await fetch(del(`/api/v1/token/${token.id}`));
    expect(response.status).toBe(204);

    const deleted = await db.token.findUnique({ where: { id: token.id } });
    expect(deleted).toBeNull();
  });

  it('deletes an OrganizationUser token', async () => {
    const { entity: token } = await createToken({ ownerModel: 'OrganizationUser' }, { OrganizationUser: orgUser });

    const response = await fetch(del(`/api/v1/token/${token.id}`));
    expect(response.status).toBe(204);

    const deleted = await db.token.findUnique({ where: { id: token.id } });
    expect(deleted).toBeNull();
  });
});
