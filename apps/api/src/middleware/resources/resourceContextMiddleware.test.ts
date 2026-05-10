import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { OpenAPIHono } from '@hono/zod-openapi';
import { OrganizationScalarSchema } from '@template/db';
import { type Organization, type User } from '@template/db';
import { cleanupTouchedTables, createOrganization, createUser } from '@template/db/test';
import { uuidv7 } from 'uuidv7';
import { getResource } from '#/lib/context/getResource';
import { readRoute } from '#/lib/routeTemplates';
import { makeController } from '#/lib/utils/makeController';
import { Modules } from '#/modules/modules';
import { createTestApp } from '#tests/createTestApp';
import { get } from '#tests/utils/request';

// Drives resourceContextMiddleware via the real readRoute template (which
// auto-attaches the middleware via prepareMiddleware) so the test surface
// matches what production code uses.
const orgReadRoute = readRoute({
  model: Modules.organization,
  responseSchema: OrganizationScalarSchema,
});

const orgReadController = makeController(orgReadRoute, async (c, respond) => {
  const resource = getResource<'organization'>(c);
  return respond.ok(resource);
});

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
          const subrouter = new OpenAPIHono();
          subrouter.openapi(orgReadRoute, orgReadController);
          app.route('/api/v1/organization', subrouter);
        },
      ],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('loads the resource into context when the id exists', async () => {
    const response = await fetch(get(`/api/v1/organization/${org.id}`));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.id).toBe(org.id);
    expect(body.data.name).toBe(org.name);
  });

  it('returns 400 when the id is not a uuidv7 (and no lookup query is set)', async () => {
    const response = await fetch(get('/api/v1/organization/not-a-uuid'));
    expect(response.status).toBe(400);
  });

  it('returns 404 when the uuid is well-formed but no row matches', async () => {
    const response = await fetch(get(`/api/v1/organization/${uuidv7()}`));
    expect(response.status).toBe(404);
  });

  it('supports lookup by another field — `?lookup=slug` accepts non-uuid id', async () => {
    const response = await fetch(get(`/api/v1/organization/${org.slug}?lookup=slug`));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.id).toBe(org.id);
  });
});
