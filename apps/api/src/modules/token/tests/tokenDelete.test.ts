import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { Organization, OrganizationUser, User } from '@template/db/generated/client/client';
import { cleanupTouchedTables, createOrganizationUser, createToken } from '@template/db/test';
import { tokenRouter } from '#/modules/token';
import { createTestApp } from '#tests/createTestApp';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { createTokenProbeApp } from '#tests/utils/createTokenProbeApp';
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
    user = context.user;
    org = context.organization;

    const harness = createTestApp({
      mockUser: user,
      mockOrganizationUsers: [orgUser],
      mount: [(app) => app.route('/api/v1/token', tokenRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('deletes a User token', async () => {
    const { entity: token } = await createToken({ ownerModel: 'User' }, { user });

    const response = await fetch(del(`/api/v1/token/${token.id}`));
    expect(response.status).toBe(204);

    const deleted = await db.token.findUnique({ where: { id: token.id } });
    expect(deleted).toBeNull();
  });

  it('deletes an Organization token', async () => {
    const { entity: token } = await createToken(
      { ownerModel: 'Organization' },
      { organization: org },
    );

    const response = await fetch(del(`/api/v1/token/${token.id}`));
    expect(response.status).toBe(204);

    const deleted = await db.token.findUnique({ where: { id: token.id } });
    expect(deleted).toBeNull();
  });

  it('deletes an OrganizationUser token', async () => {
    const { entity: token } = await createToken(
      { ownerModel: 'OrganizationUser' },
      { organizationUser: orgUser },
    );

    const response = await fetch(del(`/api/v1/token/${token.id}`));
    expect(response.status).toBe(204);

    const deleted = await db.token.findUnique({ where: { id: token.id } });
    expect(deleted).toBeNull();
  });
});

describe('a token deletes tokens: it only removes access (R84)', () => {
  const { call } = createTokenProbeApp((hono) => hono.route('/api/v1/token', tokenRouter));

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  const memberToken = async (
    seat: OrganizationUser,
    data: { role: 'admin' | 'viewer' | null; full?: boolean },
  ) => createKeyedToken({ ownerModel: 'OrganizationUser', ...data }, { organizationUser: seat });

  it("a member's full token deletes another token of that member", async () => {
    const { entity: seat } = await createOrganizationUser({ role: 'admin' });
    const { rawKey } = await memberToken(seat, { role: null, full: true });
    const { entity: sibling } = await memberToken(seat, { role: 'viewer' });
    expect((await call(rawKey, 'DELETE', `/api/v1/token/${sibling.id}`)).status).toBe(204);
  });

  it("a token cannot delete a token outside its owner's reach", async () => {
    const { entity: seat, context } = await createOrganizationUser({ role: 'member' });
    const { rawKey } = await memberToken(seat, { role: null, full: true });
    const { entity: other } = await createOrganizationUser(
      { role: 'member' },
      { organization: context.organization },
    );
    const { entity: theirs } = await memberToken(other, { role: 'viewer' });
    expect((await call(rawKey, 'DELETE', `/api/v1/token/${theirs.id}`)).status).toBe(403);
  });
});
