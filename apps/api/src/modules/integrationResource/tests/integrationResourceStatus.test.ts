import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { Integration, IntegrationResource, User } from '@template/db/generated/client/client';
import { EntitlementResourceModel } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createIntegration,
  createIntegrationResource,
  createProject,
  createToken,
  createUser,
} from '@template/db/test';
import { fetchPermixForUser } from '#/lib/permissions/userPermissions';
import { integrationRouter } from '#/modules/integration';
import { integrationResourceRouter } from '#/modules/integrationResource';
import { linkProjectResource } from '#/modules/project/services/linkProjectResource';
import { createTestApp } from '#tests/createTestApp';
import { del, get, parseSuccessBody, patch, post } from '#tests/utils/request';

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

  it('lists a missing resource beside the tracked ones, and the untracked list holds neither', async () => {
    const { entity: tracked } = await createIntegrationResource({}, { integration });
    const { entity: missing } = await createIntegrationResource(
      { status: 'missing' },
      { integration },
    );
    const { entity: other } = await createIntegration({ ownerModel: 'User', userId: user.id });
    await createIntegrationResource({ status: 'untracked' }, { integration: other });

    expect((await listed()).sort()).toEqual([tracked.id, missing.id].sort());
    expect(await listed('/untracked')).toEqual([]);
  });

  it('tracking lifts untracked but never clears a missing the sync set', async () => {
    const { entity: missing } = await createIntegrationResource(
      { status: 'missing' },
      { integration },
    );
    await fetch(patch(`/api/v1/integrationResource/${missing.id}`, { status: 'tracked' }));
    expect(
      (await db.integrationResource.findUniqueOrThrow({ where: { id: missing.id } })).status,
    ).toBe('missing');
  });

  it('refuses a status in the create body: a resource is registered tracked', async () => {
    const response = await fetch(
      post(`/api/v1/integration/${integration.id}/integrationResources`, {
        name: 'General',
        kind: 'channel',
        externalId: 'C123',
        status: 'missing',
      }),
    );
    expect(response.status).toBe(422);
  });

  it('refuses tracking for a stranger, and a removed resource is not found', async () => {
    const { entity: resource } = await createIntegrationResource({}, { integration });
    const { entity: stranger } = await createUser();
    expect(
      (
        await harnessFor(stranger).fetch(
          patch(`/api/v1/integrationResource/${resource.id}`, { status: 'untracked' }),
        )
      ).status,
    ).toBe(403);

    await db.integrationResource.update({
      where: { id: resource.id },
      data: { deletedAt: new Date() },
    });
    expect(
      (await fetch(patch(`/api/v1/integrationResource/${resource.id}`, { status: 'untracked' })))
        .status,
    ).toBe(404);
    expect((await fetch(del(`/api/v1/integrationResource/${resource.id}`))).status).toBe(404);
  });

  it('refuses linking an untracked resource to a project', async () => {
    const { entity: resource } = await createIntegrationResource(
      { status: 'untracked' },
      { integration },
    );
    const { entity: project } = await createProject({ ownerModel: 'User' }, { user });
    await expect(
      db.txn(async () =>
        linkProjectResource((await fetchPermixForUser(user.id))!, {
          projectId: project.id,
          integrationResourceId: resource.id,
        }),
      ),
    ).rejects.toThrow('untracked');
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

  it('deleting one resource degrades the entitlements anchored at it', async () => {
    const { entity: resource } = await createIntegrationResource({}, { integration });
    const { entity: token } = await createToken(
      {
        ownerModel: 'User',
        role: 'viewer',
        entitlements: [
          {
            resource: EntitlementResourceModel.IntegrationResource,
            actions: ['read'],
            sourceModel: EntitlementResourceModel.IntegrationResource,
            sourceId: resource.id,
          },
        ],
      },
      { user },
    );

    await fetch(del(`/api/v1/integrationResource/${resource.id}`));

    const entitlement = await db.entitlement.findFirstOrThrow({
      where: { targetModel: 'Token', targetId: token.id },
    });
    expect(entitlement.sourceDeletedAt).toBeInstanceOf(Date);
  });
});
