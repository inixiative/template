import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHash, randomUUID } from 'node:crypto';
import type { z } from '@hono/zod-openapi';
import type {
  Organization,
  OrganizationUser,
  Role,
  User,
} from '@template/db/generated/client/client';
import { cleanupTouchedTables, createOrganizationUser, createToken } from '@template/db/test';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { organizationUserRouter } from '#/modules/organizationUser';
import type { organizationUserUpdateRoute } from '#/modules/organizationUser/routes/organizationUserUpdate';
import { createTestApp } from '#tests/createTestApp';
import { json, patch } from '#tests/utils/request';

type UpdateOrgUserResponse = z.infer<typeof organizationUserUpdateRoute.responseSchema>;

describe('PATCH /api/v1/organizationUser/:id', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let org: Organization;
  let adminOrgUser: OrganizationUser;

  beforeAll(async () => {
    const { entity, context } = await createOrganizationUser({ role: 'admin' });
    adminOrgUser = entity;
    user = context.user;
    org = context.organization;

    const harness = createTestApp({
      mockUser: user,
      mockOrganizationUsers: [adminOrgUser],
      mount: [(app) => app.route('/api/v1/organizationUser', organizationUserRouter)],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('updates the role', async () => {
    const { entity: member } = await createOrganizationUser(
      { role: 'member' },
      { organization: org },
    );

    const response = await fetch(
      patch(`/api/v1/organizationUser/${member.id}`, { role: 'viewer' }),
    );
    const { data } = await json<UpdateOrgUserResponse>(response);

    expect(response.status).toBe(200);
    expect(data.role).toBe('viewer');
  });

  type Entry = {
    resource: string;
    anchor: { resource: string; id: string };
    actions: Record<string, boolean>;
  };

  const onOrganization = (...actions: string[]): Entry[] => [
    {
      resource: 'db:organization',
      anchor: { resource: 'db:organization', id: org.id },
      actions: Object.fromEntries(actions.map((action) => [action, true])),
    },
  ];

  describe("a member's entitlements are library entries the writer could grant (Aron, 2026-10-26)", () => {
    const newMember = async () =>
      (await createOrganizationUser({ role: 'member' }, { organization: org })).entity;

    const writer = async (role: Role) => {
      const { entity, context } = await createOrganizationUser({ role }, { organization: org });
      return createTestApp({
        mockUser: context.user,
        mockOrganizationUsers: [entity],
        mount: [(app) => app.route('/api/v1/organizationUser', organizationUserRouter)],
      });
    };

    const grant = async (app: ReturnType<typeof createTestApp>, entitlements: unknown) => {
      const target = await newMember();
      const response = await app.fetch(
        patch(`/api/v1/organizationUser/${target.id}`, { entitlements }),
      );
      const stored = await db.organizationUser.findUniqueOrThrow({ where: { id: target.id } });
      return { status: response.status, stored: stored.entitlements };
    };

    it('an admin grants a member operate on the organization', async () => {
      expect(await grant(await writer('admin'), onOrganization('operate'))).toEqual({
        status: 200,
        stored: onOrganization('operate'),
      });
    });

    it('an admin cannot grant a member own, and the member is unchanged', async () => {
      expect(await grant(await writer('admin'), onOrganization('own'))).toEqual({
        status: 403,
        stored: null,
      });
    });

    it("an admin clears a member's entitlements", async () => {
      const { entity: target } = await createOrganizationUser(
        { role: 'member', entitlements: onOrganization('operate') },
        { organization: org },
      );
      const response = await fetch(
        patch(`/api/v1/organizationUser/${target.id}`, { entitlements: null }),
      );
      expect(response.status).toBe(200);
      const stored = await db.organizationUser.findUniqueOrThrow({ where: { id: target.id } });
      expect(stored.entitlements).toBeNull();
    });

    it('a flat map of actions is not an entitlement', async () => {
      expect((await grant(await writer('owner'), { operate: true })).status).toBe(422);
    });
  });

  describe("an organization member's token grants as its member, capped by its own role", () => {
    const tokenApp = createTestApp({
      mount: [
        (app) => {
          app.use('*', tokenAuthMiddleware);
          app.route('/api/v1/organizationUser', organizationUserRouter);
        },
      ],
    });

    const memberToken = async (memberRole: Role, tokenRole: Role) => {
      const { entity: member } = await createOrganizationUser(
        { role: memberRole },
        { organization: org },
      );
      const key = randomUUID();
      await createToken(
        {
          ownerModel: 'OrganizationUser',
          role: tokenRole,
          keyHash: createHash('sha256').update(key).digest('hex'),
        },
        { organizationUser: member },
      );
      return key;
    };

    const grantAs = async (key: string, entitlements: Entry[]) => {
      const { entity: target } = await createOrganizationUser(
        { role: 'member' },
        { organization: org },
      );
      const response = await tokenApp.fetch(
        new Request(`http://test/api/v1/organizationUser/${target.id}`, {
          method: 'PATCH',
          headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
          body: JSON.stringify({ entitlements }),
        }),
      );
      return response.status;
    };

    it('an owner-role token on an owner member grants what the member could', async () => {
      const key = await memberToken('owner', 'owner');
      expect(await grantAs(key, onOrganization('operate'))).toBe(200);
      expect(await grantAs(key, onOrganization('own'))).toBe(200);
    });

    it('an owner-role token on an admin member grants no more than the admin', async () => {
      const key = await memberToken('admin', 'owner');
      expect(await grantAs(key, onOrganization('operate'))).toBe(200);
      expect(await grantAs(key, onOrganization('own'))).toBe(403);
    });

    it('a viewer-role token on an owner member grants nothing above read', async () => {
      const key = await memberToken('owner', 'viewer');
      expect(await grantAs(key, onOrganization('operate'))).toBe(403);
    });
  });
});
