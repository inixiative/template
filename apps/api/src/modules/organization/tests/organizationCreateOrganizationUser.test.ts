import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { OpenAPIHono, type z } from '@hono/zod-openapi';
import type { Organization, OrganizationUser, User } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createUser,
} from '@template/db/test';
import { validateActor } from '#/middleware/validations/validateActor';
import { organizationCreateOrganizationUserController } from '#/modules/organization/controllers/organizationCreateOrganizationUser';
import { organizationCreateOrganizationUserRoute } from '#/modules/organization/routes/organizationCreateOrganizationUser';
import type { AppEnv } from '#/types/appEnv';
import { createTestApp } from '#tests/createTestApp';
import { json, jsonError, jsonValidationFailure, post } from '#tests/utils/request';

type CreateOrganizationUserResponse = z.infer<
  typeof organizationCreateOrganizationUserRoute.responseSchema
>;

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

    const { entity: ou } = await createOrganizationUser(
      { role: 'admin' },
      { user: admin, organization: org },
    );
    adminOrgUser = ou;

    const router = new OpenAPIHono<AppEnv>();
    router.use('*', validateActor);
    router.openapi(
      organizationCreateOrganizationUserRoute,
      organizationCreateOrganizationUserController,
    );

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

  it('rejects a body with neither userId nor email with the schema-failure 400', async () => {
    const path = `/api/v1/organization/${org.id}/organizationUsers`;
    const membershipsBefore = await db.organizationUser.count({
      where: { organizationId: org.id },
    });

    const refinementResponse = await fetch(post(path, { role: 'member' }));
    const schemaResponse = await fetch(post(path, { email: 'not-an-email', role: 'member' }));
    const refinementBody = await jsonValidationFailure(refinementResponse);
    const schemaBody = await jsonValidationFailure(schemaResponse);

    expect(refinementResponse.status).toBe(400);
    expect(schemaResponse.status).toBe(400);
    expect(Object.keys(refinementBody).sort()).toEqual(Object.keys(schemaBody).sort());
    expect(Object.keys(refinementBody.error).sort()).toEqual(Object.keys(schemaBody.error).sort());
    expect(refinementBody.success).toBe(false);
    expect(refinementBody.error.name).toBe(schemaBody.error.name);
    expect(refinementBody.error.message).toContain('Either userId or email is required');
    expect(await db.organizationUser.count({ where: { organizationId: org.id } })).toBe(
      membershipsBefore,
    );
  });
});
