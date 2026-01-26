import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Organization, User } from '@template/db';
import { cleanupTouchedTables, createOrganization, createUser } from '@template/db/test';
import { getResource, getResourceType } from '#/lib/context/getResource';
import { resourceContextMiddleware } from '#/middleware/resources/resourceContextMiddleware';
import { createTestApp } from '#tests/createTestApp';
import { get } from '#tests/utils/request';

describe('resourceContextMiddleware', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let org: Organization;

  beforeAll(async () => {
    const { entity: u } = await createUser();
    user = u;

    const { entity: o } = await createOrganization();
    org = o;

    const harness = createTestApp({
      mockUser: user,
      mount: [
        (app) => {
          const testRouter = new OpenAPIHono();

          testRouter.use('/:id', resourceContextMiddleware());

          testRouter.get('/:id', (c) => {
            const resource = getResource<'organization'>(c);
            const resourceType = getResourceType(c);
            return c.json({ resource, resourceType });
          });

          app.route('/api/v1/organization', testRouter);
        },
      ],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('loads resource into context when id exists', async () => {
    const response = await fetch(get(`/api/v1/organization/${org.id}`));
    expect(response.status).toBe(200);

    const { resource, resourceType } = await response.json();
    expect(resource.id).toBe(org.id);
    expect(resource.name).toBe(org.name);
    expect(resourceType).toBe('organization');
  });

  it('returns 404 when resource not found', async () => {
    const response = await fetch(get('/api/v1/organization/nonexistent-id'));
    expect(response.status).toBe(404);
  });

  it('supports lookup by different field', async () => {
    const response = await fetch(get(`/api/v1/organization/${org.slug}?lookup=slug`));
    expect(response.status).toBe(200);

    const { resource } = await response.json();
    expect(resource.id).toBe(org.id);
  });
});
