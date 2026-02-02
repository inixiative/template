import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { Organization, Space } from '@template/db';
import { cleanupTouchedTables, createOrganization, createSpace } from '@template/db/test';
import { adminSpaceRouter } from '#/modules/space';
import { createTestApp } from '#tests/createTestApp';
import { get, json } from '#tests/utils/request';

describe('GET /api/admin/space', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let testDb: ReturnType<typeof createTestApp>['db'];
  let org1: Organization;
  let org2: Organization;
  let space1: Space;
  let space2: Space;
  let space3: Space;

  beforeAll(async () => {
    const { entity: o1 } = await createOrganization();
    org1 = o1;
    const { entity: o2 } = await createOrganization();
    org2 = o2;

    const { entity: s1 } = await createSpace({ name: 'Alpha Space' }, { organization: org1 });
    space1 = s1;
    const { entity: s2 } = await createSpace({ name: 'Beta Space' }, { organization: org1 });
    space2 = s2;
    const { entity: s3 } = await createSpace({ name: 'Gamma Space' }, { organization: org2 });
    space3 = s3;

    const harness = createTestApp({
      mockSuperadmin: true,
      mount: [(app) => app.route('/api/admin/space', adminSpaceRouter)],
    });
    fetch = harness.fetch;
    testDb = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(testDb);
  });

  it('returns all spaces', async () => {
    const response = await fetch(get('/api/admin/space'));
    expect(response.status).toBe(200);

    const { data } = await json<Space[]>(response);
    expect(data.length).toBeGreaterThanOrEqual(3);
  });

  it('filters by organizationId', async () => {
    const response = await fetch(get(`/api/admin/space?organizationId=${org1.id}`));
    expect(response.status).toBe(200);

    const { data } = await json<Space[]>(response);
    expect(data.every((s) => s.organizationId === org1.id)).toBe(true);
  });

  it('searches by name', async () => {
    const response = await fetch(get('/api/admin/space?search=Alpha'));
    expect(response.status).toBe(200);

    const { data } = await json<Space[]>(response);
    expect(data.some((s) => s.name === 'Alpha Space')).toBe(true);
  });

  it('filters deleted spaces', async () => {
    await db.space.update({ where: { id: space2.id }, data: { deletedAt: new Date() } });

    const activeResponse = await fetch(get('/api/admin/space?deleted=false'));
    const { data: activeData } = await json<Space[]>(activeResponse);
    expect(activeData.some((s) => s.id === space2.id)).toBe(false);

    const deletedResponse = await fetch(get('/api/admin/space?deleted=true'));
    const { data: deletedData } = await json<Space[]>(deletedResponse);
    expect(deletedData.some((s) => s.id === space2.id)).toBe(true);

    const allResponse = await fetch(get('/api/admin/space?deleted=all'));
    const { data: allData } = await json<Space[]>(allResponse);
    expect(allData.length).toBeGreaterThanOrEqual(3);
  });
});
