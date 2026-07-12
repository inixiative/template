import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { OpenAPIHono } from '@hono/zod-openapi';
import {
  type CronJob,
  CronJobScalarSchema,
  type Organization,
  OrganizationScalarSchema,
  type User,
} from '@template/db';
import { cleanupTouchedTables, createCronJob, createOrganization, createUser } from '@template/db/test';
import { getResource } from '#/lib/context/getResource';
import { readRoute } from '#/lib/routeTemplates';
import { makeController } from '#/lib/utils/makeController';
import { Modules } from '#/modules/modules';
import { createTestApp, type MountFn } from '#tests/createTestApp';
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

// CronJob has no deletedAt column — proves the soft-delete filter is only
// appended for models that carry one.
const cronJobReadRoute = readRoute({
  model: Modules.cronJob,
  responseSchema: CronJobScalarSchema,
});

const cronJobReadController = makeController(cronJobReadRoute, async (c, respond) => {
  const resource = getResource<'cronJob'>(c);
  return respond.ok(resource);
});

const mountRoutes: MountFn = (app) => {
  const orgRouter = new OpenAPIHono();
  orgRouter.openapi(orgReadRoute, orgReadController);
  app.route('/api/v1/organization', orgRouter);

  const cronJobRouter = new OpenAPIHono();
  cronJobRouter.openapi(cronJobReadRoute, cronJobReadController);
  app.route('/api/v1/cronJob', cronJobRouter);
};

describe('resourceContextMiddleware', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let adminFetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let org: Organization;
  let deletedOrg: Organization;
  let cronJob: CronJob;

  beforeAll(async () => {
    const { entity: u } = await createUser();
    user = u;

    const { entity: superadmin } = await createUser({ platformRole: 'superadmin' });

    const { entity: o } = await createOrganization();
    org = o;

    const { entity: cj } = await createCronJob();
    cronJob = cj;

    const harness = createTestApp({
      mockUser: user,
      mount: [mountRoutes],
    });
    fetch = harness.fetch;
    db = harness.db;

    const adminHarness = createTestApp({
      mockUser: superadmin,
      mount: [mountRoutes],
    });
    adminFetch = adminHarness.fetch;

    const { entity: d } = await createOrganization();
    deletedOrg = await db.organization.update({ where: { id: d.id }, data: { deletedAt: new Date() } });
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
    const response = await fetch(get(`/api/v1/organization/${Bun.randomUUIDv7()}`));
    expect(response.status).toBe(404);
  });

  it('supports lookup by another field — `?lookup=slug` accepts non-uuid id', async () => {
    const response = await fetch(get(`/api/v1/organization/${org.slug}?lookup=slug`));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.id).toBe(org.id);
  });

  it('returns 404 for a soft-deleted resource when the caller is not a superadmin', async () => {
    const response = await fetch(get(`/api/v1/organization/${deletedOrg.id}`));
    expect(response.status).toBe(404);
  });

  it('loads a soft-deleted resource when the caller is a superadmin', async () => {
    const response = await adminFetch(get(`/api/v1/organization/${deletedOrg.id}`));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.id).toBe(deletedOrg.id);
  });

  it('leaves models without a deletedAt column unaffected', async () => {
    const response = await fetch(get(`/api/v1/cronJob/${cronJob.id}`));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.id).toBe(cronJob.id);
  });
});
