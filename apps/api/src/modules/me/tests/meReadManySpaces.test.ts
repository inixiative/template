import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { z } from '@hono/zod-openapi';
import type { User } from '@template/db/generated/client/client';
import { SpaceRole } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createSpaceUser, createUser } from '@template/db/test';
import { meRouter } from '#/modules/me';
import { meReadManySpacesRoute } from '#/modules/me/routes/meReadManySpaces';
import { createTestApp } from '#tests/createTestApp';
import { get, json } from '#tests/utils/request';

type ReadManySpacesResponse = z.infer<typeof meReadManySpacesRoute.responseSchema>[];

describe('GET /me/spaces', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;

  beforeAll(async () => {
    const { entity } = await createUser();
    user = entity;

    const harness = createTestApp({
      mockUser: user,
      mount: [(app) => app.route('/api/v1/me', meRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('returns empty array when user has no spaces', async () => {
    const response = await fetch(get('/api/v1/me/spaces'));
    const { data, pagination } = await json<ReadManySpacesResponse>(response);

    expect(response.status).toBe(200);
    expect(data).toEqual([]);
    expect(pagination!.total).toBe(0);
  });

  it('returns user spaces with membership info', async () => {
    // createSpaceUser auto-creates: User, Organization, OrganizationUser, Space
    const { entity: spaceUser, context } = await createSpaceUser({ role: SpaceRole.admin }, { user });
    const space = context.space!;
    const org = context.organization!;

    const response = await fetch(get('/api/v1/me/spaces'));
    const { data } = await json<ReadManySpacesResponse>(response);

    expect(response.status).toBe(200);
    expect(data.length).toBeGreaterThanOrEqual(1);
    const spaceWithMembership = data.find((s) => s.id === space.id);
    expect(spaceWithMembership).toBeDefined();
    expect(spaceWithMembership!.spaceUser.role).toBe('admin');
    expect(spaceWithMembership!.organization.id).toBe(org.id);
  });

  it('returns multiple spaces across orgs', async () => {
    // Two separate SpaceUsers = two separate orgs and spaces
    await createSpaceUser({ role: SpaceRole.owner }, { user });
    await createSpaceUser({ role: SpaceRole.member }, { user });

    const response = await fetch(get('/api/v1/me/spaces'));
    const { data, pagination } = await json<ReadManySpacesResponse>(response);

    expect(response.status).toBe(200);
    expect(data.length).toBeGreaterThanOrEqual(2);
    expect(pagination!.total).toBeGreaterThanOrEqual(2);
  });

  it('excludes spaces user is not a member of', async () => {
    // Create a space for another user
    await createSpaceUser({});

    const response = await fetch(get('/api/v1/me/spaces'));
    const { data } = await json<ReadManySpacesResponse>(response);

    expect(response.status).toBe(200);
    expect(data.every((s) => s.spaceUser.userId === user.id)).toBe(true);
  });
});
