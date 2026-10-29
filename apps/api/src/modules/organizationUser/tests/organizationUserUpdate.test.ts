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
        patch(`/api/v1/organizationUser/${target.id}/entitlements`, { add: entitlements }),
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

    it("an admin removes a member's entitlements", async () => {
      const { entity: target } = await createOrganizationUser(
        { role: 'member', entitlements: onOrganization('operate') },
        { organization: org },
      );
      const response = await fetch(
        patch(`/api/v1/organizationUser/${target.id}/entitlements`, {
          remove: onOrganization('operate'),
        }),
      );
      expect(response.status).toBe(200);
      const stored = await db.organizationUser.findUniqueOrThrow({ where: { id: target.id } });
      expect(stored.entitlements).toEqual([]);
    });

    const memberApp = (user: User, organizationUser: OrganizationUser) =>
      createTestApp({
        mockUser: user,
        mockOrganizationUsers: [organizationUser],
        mount: [(app) => app.route('/api/v1/organizationUser', organizationUserRouter)],
      });

    const entitledMemberWith = async (granted: ReturnType<typeof entry>) => {
      const { entity, context } = await createOrganizationUser(
        { role: 'member' },
        { organization: org },
      );
      const response = await (await writer('owner')).fetch(
        patch(`/api/v1/organizationUser/${entity.id}/entitlements`, { add: [granted] }),
      );
      expect(response.status).toBe(200);
      const row = await db.organizationUser.findUniqueOrThrow({ where: { id: entity.id } });
      return { row, user: context.user };
    };

    describe('you write a role you hold, with manage at the organization (Aron, 2026-10-26)', () => {
      const holderOf = async (action: string) => {
        const { row, user } = await entitledMemberWith(
          entry('db:organization', ['db:organization', org.id], [action]),
        );
        return { user, app: memberApp(user, row) };
      };
      const setRole = (app: ReturnType<typeof memberApp>, id: string, role: Role) =>
        app.fetch(patch(`/api/v1/organizationUser/${id}`, { role }));

      it('a member cannot make a member', async () => {
        const { context, entity } = await createOrganizationUser(
          { role: 'member' },
          { organization: org },
        );
        const target = await newMember();
        expect((await setRole(memberApp(context.user, entity), target.id, 'viewer')).status).toBe(
          403,
        );
      });

      it('manage granted on the organization makes admins and removes them, not owners', async () => {
        const { app } = await holderOf('manage');
        const target = await newMember();
        expect((await setRole(app, target.id, 'admin')).status).toBe(200);
        expect((await setRole(app, target.id, 'owner')).status).toBe(403);
        const { entity: admin } = await createOrganizationUser(
          { role: 'admin' },
          { organization: org },
        );
        expect((await app.fetch(del(`/api/v1/organizationUser/${admin.id}`))).status).toBe(204);
        const { entity: owner } = await createOrganizationUser(
          { role: 'owner' },
          { organization: org },
        );
        expect((await setRole(app, owner.id, 'viewer')).status).toBe(403);
        expect((await app.fetch(del(`/api/v1/organizationUser/${owner.id}`))).status).toBe(403);
      });

      it('own granted on the organization makes owners', async () => {
        const { app } = await holderOf('own');
        const target = await newMember();
        expect((await setRole(app, target.id, 'owner')).status).toBe(200);
      });

      it('an admin grants manage, not own', async () => {
        const target = await newMember();
        const admin = await writer('admin');
        const grantOn = (action: string) =>
          admin.fetch(
            patch(`/api/v1/organizationUser/${target.id}/entitlements`, {
              add: [entry('db:organization', ['db:organization', org.id], [action])],
            }),
          );
        expect((await grantOn('manage')).status).toBe(200);
        expect((await grantOn('own')).status).toBe(403);
      });

      it("the holder's owner-role user token sets roles the holder holds", async () => {
        const { user } = await holderOf('manage');
        const { rawKey } = await createKeyedToken({ ownerModel: 'User', role: 'owner' }, { user });
        const target = await newMember();
        const response = await createTestApp({
          mount: [
            (app) => {
              app.use('*', tokenAuthMiddleware);
              app.route('/api/v1/organizationUser', organizationUserRouter);
            },
          ],
        }).fetch(
          new Request(`http://test/api/v1/organizationUser/${target.id}`, {
            method: 'PATCH',
            headers: { authorization: `Bearer ${rawKey}`, 'content-type': 'application/json' },
            body: JSON.stringify({ role: 'admin' }),
          }),
        );
        expect(response.status).toBe(200);
      });
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
        new Request(`http://test/api/v1/organizationUser/${target.id}/entitlements`, {
          method: 'PATCH',
          headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
          body: JSON.stringify({ add: entitlements }),
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
