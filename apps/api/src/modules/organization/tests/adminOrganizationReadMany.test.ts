import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { z } from '@hono/zod-openapi';
import type { Organization, User } from '@template/db/generated/client/client';
import { PlatformRole } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createOrganization, createUser } from '@template/db/test';
import { adminOrganizationRouter } from '#/modules/organization';
import type { adminOrganizationReadManyRoute } from '#/modules/organization/routes/adminOrganizationReadMany';
import { createTestApp } from '#tests/createTestApp';
import { get, json, jsonError } from '#tests/utils/request';

type ReadManyResponse = z.infer<typeof adminOrganizationReadManyRoute.responseSchema>[];

describe('GET /api/admin/organization', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let superadmin: User;
  let orgA: Organization;
  let _orgB: Organization;
  let _orgC: Organization;

  beforeAll(async () => {
    const { entity: sa } = await createUser({ platformRole: PlatformRole.superadmin });
    superadmin = sa;

    const { entity: a } = await createOrganization({ name: 'Apple Inc' });
    orgA = a;

    const { entity: b } = await createOrganization({ name: 'Banana Corp' });
    _orgB = b;

    const { entity: c } = await createOrganization({ name: 'Cherry LLC' });
    _orgC = c;

    const harness = createTestApp({
      mockUser: superadmin,
      mount: [(app) => app.route('/api/admin/organization', adminOrganizationRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('returns paginated organizations', async () => {
    const response = await fetch(get('/api/admin/organization?page=1&pageSize=10'));
    const { data, pagination } = await json<ReadManyResponse>(response);

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(3);
    expect(pagination?.page).toBe(1);
    expect(pagination?.pageSize).toBe(10);
  });

  it('sorts by name ascending', async () => {
    const response = await fetch(get('/api/admin/organization?orderBy=name:asc'));
    const { data } = await json<ReadManyResponse>(response);

    expect(response.status).toBe(200);
    const names = data.map((org) => org.name);
    const sortedNames = [...names].sort();
    expect(names).toEqual(sortedNames);
  });

  it('sorts by name descending', async () => {
    const response = await fetch(get('/api/admin/organization?orderBy=name:desc'));
    const { data } = await json<ReadManyResponse>(response);

    expect(response.status).toBe(200);
    const names = data.map((org) => org.name);
    const sortedNames = [...names].sort().reverse();
    expect(names).toEqual(sortedNames);
  });

  it('sorts by multiple fields', async () => {
    const response = await fetch(
      get('/api/admin/organization?orderBy=name:asc&orderBy=createdAt:desc'),
    );
    const { data } = await json<ReadManyResponse>(response);

    expect(response.status).toBe(200);
    expect(data.length).toBeGreaterThanOrEqual(3);
  });

  it('filters by name field search', async () => {
    const response = await fetch(get('/api/admin/organization?searchFields[name]=Apple'));
    const { data } = await json<ReadManyResponse>(response);

    expect(response.status).toBe(200);
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((org) => org.name.includes('Apple'))).toBe(true);
  });

  it('field search is case-sensitive', async () => {
    const response = await fetch(get('/api/admin/organization?searchFields[name]=apple'));
    const { data } = await json<ReadManyResponse>(response);

    expect(response.status).toBe(200);
    expect(data.some((org) => org.id === orgA.id)).toBe(false);
  });

  it('filters by advanced search on specific field', async () => {
    const response = await fetch(get('/api/admin/organization?searchFields[name]=Banana'));
    const { data } = await json<ReadManyResponse>(response);

    expect(response.status).toBe(200);
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((org) => org.name.includes('Banana'))).toBe(true);
  });

  it('combines searchFields with filters', async () => {
    const response = await fetch(
      get('/api/admin/organization?searchFields[name]=Cherry&deleted=false'),
    );
    const { data } = await json<ReadManyResponse>(response);

    expect(response.status).toBe(200);
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((org) => org.name.includes('Cherry'))).toBe(true);
  });

  it('combines orderBy with searchFields', async () => {
    const response = await fetch(
      get('/api/admin/organization?searchFields[name]=a&orderBy=name:asc'),
    );
    const { data } = await json<ReadManyResponse>(response);

    expect(response.status).toBe(200);
    const names = data.map((org) => org.name);
    const sortedNames = [...names].sort();
    expect(names).toEqual(sortedNames);
  });

  it('rejects invalid searchFields (not a valid db field)', async () => {
    const response = await fetch(get('/api/admin/organization?searchFields[invalidField]=test'));

    expect(response.status).toBe(400);
    const { message } = await jsonError(response);
    expect(message).toContain('Invalid query parameters');
  });

  it('filters by multiple valid searchFields', async () => {
    const response = await fetch(get('/api/admin/organization?searchFields[name]=Banana'));
    const { data } = await json<ReadManyResponse>(response);

    expect(response.status).toBe(200);
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((org) => org.name.includes('Banana'))).toBe(true);
  });
});
