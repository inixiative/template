import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { Integration, IntegrationResource, User } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createIntegrationResource,
  createUser,
} from '@template/db/test';
import { integrationRouter } from '#/modules/integration';
import { integrationResourceRouter } from '#/modules/integrationResource';
import { createTestApp } from '#tests/createTestApp';
import { del, get, parseSuccessBody, patch } from '#tests/utils/request';

describe('integration resource status and removal', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let integration: Integration;

  const harnessFor = (mockUser: User) =>
    createTestApp({
      mockUser,
      mount: [
        (app) => app.route('/api/v1/integration', integrationRouter),
        (app) => app.route('/api/v1/integrationResource', integrationResourceRouter),
      ],
    });

  beforeEach(async () => {
    user = (await createUser()).entity;
    integration = (await createIntegration({ ownerModel: 'User', userId: user.id })).entity;
    ({ fetch, db } = harnessFor(user));
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  const listed = async (path = '') =>
    (
      await parseSuccessBody<IntegrationResource[]>(
        await fetch(get(`/api/v1/integration/${integration.id}/integrationResources${path}`)),
      )
    ).data.map((resource) => resource.id);

  it('an untracked resource leaves the list for the untracked list, and tracking it brings it back', async () => {
    const { entity: kept } = await createIntegrationResource({}, { integration });
    const { entity: ignored } = await createIntegrationResource({}, { integration });

    const untracked = await fetch(
      patch(`/api/v1/integrationResource/${ignored.id}`, { status: 'untracked' }),
    );
    expect(untracked.status).toBe(200);
    expect(await listed()).toEqual([kept.id]);
    expect(await listed('/untracked')).toEqual([ignored.id]);

    await fetch(patch(`/api/v1/integrationResource/${ignored.id}`, { status: 'tracked' }));
    expect((await listed()).sort()).toEqual([kept.id, ignored.id].sort());
    expect(await listed('/untracked')).toEqual([]);
  });

  it('lists a missing resource beside the tracked ones', async () => {
    const { entity: missing } = await createIntegrationResource(
      { status: 'missing' },
      { integration },
    );
    expect(await listed()).toEqual([missing.id]);
  });

  it('refuses a caller setting missing, which only the system sets', async () => {
    const { entity: resource } = await createIntegrationResource({}, { integration });
    const response = await fetch(
      patch(`/api/v1/integrationResource/${resource.id}`, { status: 'missing' }),
    );
    expect(response.status).toBe(422);
  });

  it('refuses filtering the main list by untracked', async () => {
    const response = await fetch(
      get(
        `/api/v1/integration/${integration.id}/integrationResources?searchFields[status]=untracked`,
      ),
    );
    expect(response.status).toBe(400);
    expect(
      (
        await fetch(
          get(
            `/api/v1/integration/${integration.id}/integrationResources?searchFields[status]=tracked`,
          ),
        )
      ).status,
    ).toBe(200);
  });

  it('deletes a resource softly, and only for whoever manages its integration', async () => {
    const { entity: resource } = await createIntegrationResource({}, { integration });
    const { entity: stranger } = await createUser();

    expect(
      (await harnessFor(stranger).fetch(del(`/api/v1/integrationResource/${resource.id}`))).status,
    ).toBe(403);

    expect((await fetch(del(`/api/v1/integrationResource/${resource.id}`))).status).toBe(204);
    expect(await listed()).toEqual([]);
    expect(
      (
        await db.withDeleted(() =>
          db.integrationResource.findUniqueOrThrow({ where: { id: resource.id } }),
        )
      ).deletedAt,
    ).toBeInstanceOf(Date);
  });
});
