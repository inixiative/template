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

  describe('a grant is an action: the writer could take every action the member would hold (Aron, 2026-10-25)', () => {
    const newMember = async () =>
      (await createOrganizationUser({ role: 'member' }, { organization: org })).entity;

    const writer = async (role: Role, entitlements?: Record<string, boolean>) => {
      const { entity, context } = await createOrganizationUser(
        { role, entitlements },
        { organization: org },
      );
      return createTestApp({
        mockUser: context.user,
        mockOrganizationUsers: [entity],
        mount: [(app) => app.route('/api/v1/organizationUser', organizationUserRouter)],
      });
    };

    const grant = async (
      app: ReturnType<typeof createTestApp>,
      entitlements: Record<string, boolean>,
    ) => {
      const target = await newMember();
      const response = await app.fetch(
        patch(`/api/v1/organizationUser/${target.id}`, { entitlements }),
      );
      const stored = await db.organizationUser.findUniqueOrThrow({ where: { id: target.id } });
      return { status: response.status, stored: stored.entitlements };
    };

    it('an admin grants a member operate', async () => {
      expect(await grant(await writer('admin'), { operate: true })).toEqual({
        status: 200,
        stored: { operate: true },
      });
    });

    it('an admin cannot grant a member own, and the member is unchanged', async () => {
      expect(await grant(await writer('admin'), { own: true })).toEqual({
        status: 403,
        stored: null,
      });
    });

    it('an admin cannot grant assign: the member could then assign owners', async () => {
      expect(await grant(await writer('admin'), { assign: true })).toEqual({
        status: 403,
        stored: null,
      });
    });

    it('an owner grants assign', async () => {
      expect(await grant(await writer('owner'), { assign: true })).toEqual({
        status: 200,
        stored: { assign: true },
      });
    });

    it('a custom action only by a writer who holds it, owner or not', async () => {
      expect((await grant(await writer('owner'), { 'report.export': true })).status).toBe(403);
      expect((await grant(await writer('admin'), { 'report.export': true })).status).toBe(403);
      expect(
        (await grant(await writer('admin', { 'report.export': true }), { 'report.export': true }))
          .status,
      ).toBe(200);
    });

    it("an admin clears a member's entitlements", async () => {
      const { entity: target } = await createOrganizationUser(
        { role: 'member', entitlements: { operate: true } },
        { organization: org },
      );
      const response = await fetch(
        patch(`/api/v1/organizationUser/${target.id}`, { entitlements: null }),
      );
      expect(response.status).toBe(200);
      const stored = await db.organizationUser.findUniqueOrThrow({ where: { id: target.id } });
      expect(stored.entitlements).toBeNull();
    });

    it('entitlements are a map of actions to booleans', async () => {
      const target = await newMember();
      const response = await fetch(
        patch(`/api/v1/organizationUser/${target.id}`, { entitlements: { own: 'yes' } }),
      );
      expect(response.status).toBe(422);
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

    const grantAs = async (key: string, entitlements: Record<string, boolean>) => {
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
      expect(await grantAs(key, { operate: true })).toBe(200);
      expect(await grantAs(key, { assign: true })).toBe(200);
    });

    it('an owner-role token on an admin member grants no more than the admin', async () => {
      const key = await memberToken('admin', 'owner');
      expect(await grantAs(key, { operate: true })).toBe(200);
      expect(await grantAs(key, { own: true })).toBe(403);
      expect(await grantAs(key, { assign: true })).toBe(403);
    });

    it('a viewer-role token on an owner member grants nothing above read', async () => {
      const key = await memberToken('owner', 'viewer');
      expect(await grantAs(key, { operate: true })).toBe(403);
    });
  });
});
