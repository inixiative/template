import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { OpenAPIHono, type z } from '@hono/zod-openapi';
import type { Organization, OrganizationUser, User } from '@template/db';
import { cleanupTouchedTables, createOrganization, createOrganizationUser, createUser } from '@template/db/test';
import { organizationCreateOrganizationUserController } from '#/modules/organization/controllers/organizationCreateOrganizationUser';
import { organizationCreateOrganizationUserRoute } from '#/modules/organization/routes/organizationCreateOrganizationUser';
import { validateActor } from '#/middleware/validations/validateActor';
import type { AppEnv } from '#/types/appEnv';
import { createTestApp } from '#tests/createTestApp';
import { json, jsonError, post } from '#tests/utils/request';

type CreateOrganizationUserResponse = z.infer<typeof organizationCreateOrganizationUserRoute.responseSchema>;

describe('POST /api/v1/organization/:id/organizationUsers', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let admin: User;
  let org: Organization;
  let adminOrgUser: OrganizationUser;

  beforeAll(async () => {
    const { entity: a } = await createUser();
    admin = a;

    const { entity: o } = await createOrganization();
    org = o;

    const { entity: ou } = await createOrganizationUser({ role: 'admin' }, { user: admin, organization: org });
    adminOrgUser = ou;

    const router = new OpenAPIHono<AppEnv>();
    router.use('*', validateActor);
    router.openapi(organizationCreateOrganizationUserRoute, organizationCreateOrganizationUserController);

    const harness = createTestApp({
      mockUser: admin,
      mockOrganizationUsers: [adminOrgUser],
      mount: [(app) => app.route('/api/v1/organization', router)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('adds a user to the organization', async () => {
    const { entity: invitee } = await createUser();

    const response = await fetch(
      post(`/api/v1/organization/${org.id}/organizationUsers`, {
        userId: invitee.id,
        role: 'member',
      }),
    );
    const { data } = await json<CreateOrganizationUserResponse>(response);

    expect(response.status).toBe(201);
    expect(data.userId).toBe(invitee.id);
    expect(data.organizationId).toBe(org.id);
    expect(data.role).toBe('member');
  });

  it('rejects duplicate membership', async () => {
    const { entity: existingMember } = await createUser();
    await createOrganizationUser({ role: 'member' }, { user: existingMember, organization: org });

    const response = await fetch(
      post(`/api/v1/organization/${org.id}/organizationUsers`, {
        userId: existingMember.id,
        role: 'member',
      }),
    );
    const body = await jsonError(response);

    expect(response.status).toBe(409);
    expect(body.error).toBeDefined();
  });
});
