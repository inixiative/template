import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { Integration, IntegrationResource, User } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createIntegrationResource,
  createProject,
  createUser,
} from '@template/db/test';
import { integrationRouter } from '#/modules/integration';
import { createTestApp } from '#tests/createTestApp';
import { get, parseSuccessBody, post } from '#tests/utils/request';

describe('integration resources', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let integration: Integration;

  beforeEach(async () => {
    user = (await createUser()).entity;
    integration = (await createIntegration({ ownerModel: 'User', userId: user.id })).entity;
    const harness = createTestApp({
      mockUser: user,
      mount: [(app) => app.route('/api/v1/integration', integrationRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  const register = (body: Record<string, unknown>) =>
    fetch(
      post(`/api/v1/integration/${integration.id}/integrationResources`, {
        name: 'General',
        kind: 'channel',
        externalId: 'C123',
        ...body,
      }),
    );

  it('registers a resource on the integration', async () => {
    const response = await register({});
    const { data } = await parseSuccessBody<IntegrationResource>(response);

    expect(response.status).toBe(201);
    expect(data).toMatchObject({
      integrationId: integration.id,
      kind: 'channel',
      externalId: 'C123',
      metadata: {},
    });
  });

  it('refuses a live resource registered twice, and registers a removed one again', async () => {
    const first = await parseSuccessBody<IntegrationResource>(await register({}));
    expect((await register({})).status).toBe(409);

    await db.integrationResource.update({
      where: { id: first.data.id },
      data: { deletedAt: new Date() },
    });
    const again = await register({});

    expect(again.status).toBe(201);
    expect((await parseSuccessBody<IntegrationResource>(again)).data.id).not.toBe(first.data.id);
  });

  it('links the resource to a project the caller manages', async () => {
    const { entity: project } = await createProject({ ownerModel: 'User' }, { user });
    const { data } = await parseSuccessBody<IntegrationResource>(
      await register({ projectId: project.id }),
    );

    expect(
      await db.projectIntegrationResource.findMany({ where: { integrationResourceId: data.id } }),
    ).toMatchObject([{ projectId: project.id }]);
  });

  it('refuses a link to a project the caller cannot manage, and registers nothing', async () => {
    const { entity: stranger } = await createUser();
    const { entity: project } = await createProject({ ownerModel: 'User' }, { user: stranger });

    expect((await register({ projectId: project.id })).status).toBe(403);
    expect(await db.integrationResource.count({ where: { integrationId: integration.id } })).toBe(
      0,
    );
  });

  it('refuses a resource on another owner’s integration', async () => {
    const { entity: stranger } = await createUser();
    const { entity: theirs } = await createIntegration({
      ownerModel: 'User',
      userId: stranger.id,
    });

    const response = await fetch(
      post(`/api/v1/integration/${theirs.id}/integrationResources`, {
        name: 'General',
        kind: 'channel',
        externalId: 'C123',
      }),
    );

    expect(response.status).toBe(403);
  });

  it('lists the live resources of the integration', async () => {
    const { entity: kept } = await createIntegrationResource({}, { integration });
    const { entity: removed } = await createIntegrationResource({}, { integration });
    await db.integrationResource.update({
      where: { id: removed.id },
      data: { deletedAt: new Date() },
    });

    const { data } = await parseSuccessBody<IntegrationResource[]>(
      await fetch(get(`/api/v1/integration/${integration.id}/integrationResources`)),
    );

    expect(data.map((resource) => resource.id)).toEqual([kept.id]);
  });
});
