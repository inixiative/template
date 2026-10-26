import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { z } from '@hono/zod-openapi';
import type {
  Organization,
  OrganizationUser,
  Role,
  User,
} from '@template/db/generated/client/client';
import { cleanupTouchedTables, createOrganizationUser } from '@template/db/test';
import { tokenAuthMiddleware } from '#/middleware/auth/tokenAuthMiddleware';
import { organizationUserRouter } from '#/modules/organizationUser';
import type { organizationUserUpdateRoute } from '#/modules/organizationUser/routes/organizationUserUpdate';
import { createTestApp } from '#tests/createTestApp';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { type Entry, entry } from '#tests/utils/entitlementEntry';
import { del, json, patch } from '#tests/utils/request';

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

  const onOrganization = (...actions: string[]): Entry[] => [
    entry('db:organization', ['db:organization', org.id], actions),
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

    const memberApp = (user: User, organizationUser: OrganizationUser) =>
      createTestApp({
        mockUser: user,
        mockOrganizationUsers: [organizationUser],
        mount: [(app) => app.route('/api/v1/organizationUser', organizationUserRouter)],
      });

    const entitledMember = async (actions: string[]) => {
      const { entity, context } = await createOrganizationUser(
        { role: 'member' },
        { organization: org },
      );
      const granted = await (await writer('owner')).fetch(
        patch(`/api/v1/organizationUser/${entity.id}`, {
          entitlements: [entry('db:organizationUser', ['db:organization', org.id], actions)],
        }),
      );
      expect(granted.status).toBe(200);
      const stored = await db.organizationUser.findUniqueOrThrow({ where: { id: entity.id } });
      return { row: stored, app: memberApp(context.user, stored) };
    };

    it('an admin grants assignLow; its holder cannot make themselves owner', async () => {
      const { entity: target, context } = await createOrganizationUser(
        { role: 'member' },
        { organization: org },
      );
      const granted = await (await writer('admin')).fetch(
        patch(`/api/v1/organizationUser/${target.id}`, {
          entitlements: [
            entry('db:organizationUser', ['db:organizationUser', target.id], ['assignLow']),
          ],
        }),
      );
      expect(granted.status).toBe(200);
      const stored = await db.organizationUser.findUniqueOrThrow({ where: { id: target.id } });
      const promoted = await memberApp(context.user, stored).fetch(
        patch(`/api/v1/organizationUser/${target.id}`, { role: 'owner' }),
      );
      expect(promoted.status).toBe(403);
    });

    it('assignHigh: an owner grants it, an admin cannot', async () => {
      const onRow = (target: OrganizationUser) => [
        entry('db:organizationUser', ['db:organizationUser', target.id], ['assignHigh']),
      ];
      const forOwner = await newMember();
      const forAdmin = await newMember();
      expect(
        (
          await (
            await writer('owner')
          ).fetch(
            patch(`/api/v1/organizationUser/${forOwner.id}`, { entitlements: onRow(forOwner) }),
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await (
            await writer('admin')
          ).fetch(
            patch(`/api/v1/organizationUser/${forAdmin.id}`, { entitlements: onRow(forAdmin) }),
          )
        ).status,
      ).toBe(403);
    });

    it('an assignLow holder sets and removes low roles, never high ones', async () => {
      const { app } = await entitledMember(['assignLow']);
      const low = await newMember();
      expect(
        (await app.fetch(patch(`/api/v1/organizationUser/${low.id}`, { role: 'viewer' }))).status,
      ).toBe(200);
      expect(
        (await app.fetch(patch(`/api/v1/organizationUser/${low.id}`, { role: 'admin' }))).status,
      ).toBe(403);
      const { entity: admin } = await createOrganizationUser(
        { role: 'admin' },
        { organization: org },
      );
      expect((await app.fetch(del(`/api/v1/organizationUser/${admin.id}`))).status).toBe(403);
      expect((await app.fetch(del(`/api/v1/organizationUser/${low.id}`))).status).toBe(204);
    });

    it('an assignHigh holder also sets low roles and removes anyone below owner', async () => {
      const { app } = await entitledMember(['assignHigh']);
      const low = await newMember();
      expect(
        (await app.fetch(patch(`/api/v1/organizationUser/${low.id}`, { role: 'admin' }))).status,
      ).toBe(200);
      expect(
        (await app.fetch(patch(`/api/v1/organizationUser/${low.id}`, { role: 'viewer' }))).status,
      ).toBe(200);
      expect((await app.fetch(del(`/api/v1/organizationUser/${low.id}`))).status).toBe(204);
    });

    it('an entitlement may carry a where; a malformed where is refused', async () => {
      const app = await writer('admin');
      const withWhere = (where: unknown) =>
        grant(app, [{ ...onOrganization('operate')[0], where }]);
      expect((await withWhere({ field: 'id', operator: 'equals', value: org.id })).status).toBe(
        200,
      );
      expect((await withWhere({ field: 'id', operator: 'nonsense' })).status).toBe(422);
      expect((await withWhere(null)).status).toBe(422);
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
      const { rawKey } = await createKeyedToken(
        { ownerModel: 'OrganizationUser', role: tokenRole },
        { organizationUser: member },
      );
      return rawKey;
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

    const grants = [
      {
        name: 'an owner-role token on an owner member grants what the member could',
        memberRole: 'owner',
        tokenRole: 'owner',
        statuses: { operate: 200, own: 200 },
      },
      {
        name: 'an owner-role token on an admin member grants no more than the admin',
        memberRole: 'admin',
        tokenRole: 'owner',
        statuses: { operate: 200, own: 403 },
      },
      {
        name: 'a viewer-role token on an owner member grants nothing above read',
        memberRole: 'owner',
        tokenRole: 'viewer',
        statuses: { operate: 403 },
      },
    ] as const;

    for (const row of grants)
      it(row.name, async () => {
        const key = await memberToken(row.memberRole, row.tokenRole);
        for (const [action, status] of Object.entries(row.statuses))
          expect([action, await grantAs(key, onOrganization(action))]).toEqual([action, status]);
      });
  });
});
