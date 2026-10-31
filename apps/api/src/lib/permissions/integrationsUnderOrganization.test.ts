import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db, unregisterDbHook } from '@template/db';
import type { Integration, Organization, Role } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
} from '@template/db/test';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { registerMemberSelfGrantHook } from '#/hooks/memberSelfGrant/hook';
import { integrationRouter } from '#/modules/integration';
import { organizationRouter } from '#/modules/organization';
import { organizationUserRouter } from '#/modules/organizationUser';
import { tokenRouter } from '#/modules/token';
import { createTestApp } from '#tests/createTestApp';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { createTokenProbeApp } from '#tests/utils/createTokenProbeApp';
import { type Entry, entry } from '#tests/utils/entitlementEntry';
import { del, patch, post } from '#tests/utils/request';

const { holds } = createTokenProbeApp();
const { call: viaToken } = createTokenProbeApp((hono) =>
  hono.route('/api/v1/integration', integrationRouter),
);

type Kind = 'Organization' | 'Space' | 'OrganizationUser' | 'SpaceUser';
const kinds: Kind[] = ['Organization', 'Space', 'OrganizationUser', 'SpaceUser'];
const actions = ['read', 'operate', 'manage', 'own', 'delete'] as const;

let organization: Organization;
const integrations = {} as Record<Kind, Integration>;

beforeAll(async () => {
  registerClearCacheHook();
  registerMemberSelfGrantHook();
  ({ entity: organization } = await createOrganization());
  const { entity: space } = await createSpace({}, { organization });
  const { entity: member, context } = await createOrganizationUser(
    { role: 'member' },
    { organization },
  );
  const { entity: spaceMember } = await createSpaceUser({ role: 'member' }, { ...context, space });
  const at = { organizationId: organization.id, role: 'viewer' as const };
  integrations.Organization = (
    await createIntegration({ ...at, ownerModel: 'Organization' })
  ).entity;
  integrations.Space = (
    await createIntegration({ ...at, ownerModel: 'Space', spaceId: space.id })
  ).entity;
  integrations.OrganizationUser = (
    await createIntegration({ ...at, ownerModel: 'OrganizationUser', userId: member.userId })
  ).entity;
  integrations.SpaceUser = (
    await createIntegration({
      ...at,
      ownerModel: 'SpaceUser',
      spaceId: space.id,
      userId: spaceMember.userId,
    })
  ).entity;
});

afterAll(async () => {
  unregisterDbHook('clearCache');
  unregisterDbHook('memberSelfGrant');
  await cleanupTouchedTables(db);
});

const seatKey = async (role: Role, entitlements?: Entry[]) => {
  const { entity: seat } = await createOrganizationUser({ role, entitlements }, { organization });
  return (
    await createKeyedToken(
      { ownerModel: 'OrganizationUser', full: true, role: null },
      { organizationUser: seat },
    )
  ).rawKey;
};

const reach = async (key: string) => {
  const table: Record<string, string[]> = {};
  for (const kind of kinds) {
    table[kind] = [];
    for (const action of actions)
      if (await holds(key, 'integration', integrations[kind].id, action)) table[kind].push(action);
  }
  return table;
};

describe("integrations under an organization: no one owns an integration; the tenant administers its own, the owner only reads and removes a member's (Aron, 2026-10-30)", () => {
  it("the owner administers the organization's and the space's, and only reads and deletes a member's", async () => {
    const administers = ['read', 'operate', 'manage', 'delete'];
    expect(await reach(await seatKey('owner'))).toEqual({
      Organization: administers,
      Space: administers,
      OrganizationUser: ['read', 'delete'],
      SpaceUser: ['read', 'delete'],
    });
  });

  it("an admin administers the organization's own integrations, and nothing of a space's or a member's", async () => {
    expect(await reach(await seatKey('admin'))).toEqual({
      Organization: ['read', 'operate', 'manage', 'delete'],
      Space: [],
      OrganizationUser: [],
      SpaceUser: [],
    });
  });
});

describe('tokens of integrations under an organization follow their integration (R83)', () => {
  const deletes = async (role: Role, kind: Kind) => {
    const { entity: seat, context } = await createOrganizationUser({ role }, { organization });
    const { entity: token } = await createKeyedToken(
      { ownerModel: 'Integration', role: 'viewer' },
      { integration: integrations[kind] },
    );
    const { app } = createTestApp({
      mockUser: context.user,
      mockOrganizationUsers: [seat],
      mount: [(hono) => hono.route('/api/v1/token', tokenRouter)],
    });
    return (await app.fetch(del(`/api/v1/token/${token.id}`))).status;
  };

  it("the owner deletes any of them; an admin only the organization's own integration's tokens; a member none", async () => {
    for (const kind of kinds) {
      expect(await deletes('owner', kind)).toBe(204);
      expect(await deletes('admin', kind)).toBe(kind === 'Organization' ? 204 : 403);
      expect(await deletes('member', kind)).toBe(403);
    }
  });
});

describe("a token given operate on its member row acts as the member, whatever its role, and only on that row's things (Aron, 2026-10-30)", () => {
  const actsAsMember = async (role: Role) => {
    const { entity: seat } = await createOrganizationUser({ role: 'member' }, { organization });
    const { entity: integration } = await createIntegration({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: seat.userId,
      role: 'viewer',
    });
    const { rawKey } = await createKeyedToken(
      {
        ownerModel: 'OrganizationUser',
        role,
        entitlements: [entry('db:organizationUser', ['db:organizationUser', seat.id], ['operate'])],
      },
      { organizationUser: seat },
    );
    return { seat, rawKey, integration };
  };

  it('a member-role token reads, operates and manages the integration', async () => {
    const { rawKey, integration } = await actsAsMember('member');
    for (const action of ['read', 'operate', 'manage', 'delete'])
      expect(await holds(rawKey, 'integration', integration.id, action)).toBe(true);
  });

  it('a viewer-role token does too: acting as the member is the entitlement, not the role', async () => {
    const { rawKey, integration } = await actsAsMember('viewer');
    expect(await holds(rawKey, 'integration', integration.id, 'manage')).toBe(true);
  });

  it("it reaches its own member row's integration, not the same person's space-member one (R100)", async () => {
    const { entity: seat, context } = await createOrganizationUser(
      { role: 'member' },
      { organization },
    );
    const { entity: space } = await createSpace({}, { organization });
    await createSpaceUser({ role: 'member' }, { ...context, space });
    const at = { organizationId: organization.id, userId: seat.userId, role: 'viewer' as const };
    const { entity: own } = await createIntegration({ ...at, ownerModel: 'OrganizationUser' });
    const { entity: spaceMembers } = await createIntegration({
      ...at,
      ownerModel: 'SpaceUser',
      spaceId: space.id,
    });
    const { rawKey } = await createKeyedToken(
      {
        ownerModel: 'OrganizationUser',
        role: 'member',
        entitlements: [entry('db:organizationUser', ['db:organizationUser', seat.id], ['operate'])],
      },
      { organizationUser: seat },
    );
    expect(await holds(rawKey, 'integration', own.id, 'read')).toBe(true);
    expect(await holds(rawKey, 'integration', spaceMembers.id, 'read')).toBe(false);
  });

  it("another member's token reaches nothing of it", async () => {
    const { integration } = await actsAsMember('member');
    const { rawKey } = await actsAsMember('member');
    expect(await holds(rawKey, 'integration', integration.id, 'read')).toBe(false);
  });
});

describe("the organization's own integrations: an admin adds them, a member uses them", () => {
  const adds = async (role: Role) => {
    const { entity: seat, context } = await createOrganizationUser({ role }, { organization });
    const { app } = createTestApp({
      mockUser: context.user,
      mockOrganizationUsers: [seat],
      mount: [(hono) => hono.route('/api/v1/organization', organizationRouter)],
    });
    return (
      await app.fetch(
        post(`/api/v1/organization/${organization.id}/integrations`, {
          name: `i-${crypto.randomUUID()}`,
          provider: 'slack',
          role: 'viewer',
        }),
      )
    ).status;
  };

  it('an admin adds one; a member does not', async () => {
    expect(await adds('admin')).toBe(201);
    expect(await adds('member')).toBe(403);
  });

  it('a member reads and operates them, and manages nothing', async () => {
    expect((await reach(await seatKey('member'))).Organization).toEqual(['read', 'operate']);
  });

  it('a viewer reads them and operates nothing', async () => {
    expect((await reach(await seatKey('viewer'))).Organization).toEqual(['read']);
  });
});

describe('a member adds their own member integration; through a member token, only as an admin (Aron, 2026-10-29)', () => {
  const { call } = createTokenProbeApp((hono) =>
    hono.route('/api/v1/organizationUser', organizationUserRouter),
  );
  const body = () => ({ name: `i-${crypto.randomUUID()}`, provider: 'slack', role: 'viewer' });

  const addsOwn = async (role: Role) => {
    const { entity: seat, context } = await createOrganizationUser({ role }, { organization });
    const { app } = createTestApp({
      mockUser: context.user,
      mockOrganizationUsers: [seat],
      mount: [(hono) => hono.route('/api/v1/organizationUser', organizationUserRouter)],
    });
    return (await app.fetch(post(`/api/v1/organizationUser/${seat.id}/integrations`, body())))
      .status;
  };

  const addsOwnByToken = async (role: Role, tokenRole: Role) => {
    const { entity: seat } = await createOrganizationUser({ role }, { organization });
    const { rawKey } = await createKeyedToken(
      { ownerModel: 'OrganizationUser', role: tokenRole },
      { organizationUser: seat },
    );
    return (await call(rawKey, 'POST', `/api/v1/organizationUser/${seat.id}/integrations`, body()))
      .status;
  };

  it('a member adds one on their own member row; a viewer does not', async () => {
    expect(await addsOwn('member')).toBe(201);
    expect(await addsOwn('viewer')).toBe(403);
  });

  it('a member-row role token adds none: a token reaches what it is given by hand (R114, Aron 2026-10-30)', async () => {
    expect(await addsOwnByToken('admin', 'admin')).toBe(403);
    expect(await addsOwnByToken('member', 'admin')).toBe(403);
  });

  it("a member's full user token is the user: it adds one on the member row, and owns the member's integrations", async () => {
    const { entity: seat, context } = await createOrganizationUser(
      { role: 'member' },
      { organization },
    );
    const { rawKey } = await createKeyedToken(
      { ownerModel: 'User', role: null, full: true },
      { user: context.user },
    );
    expect(
      (await call(rawKey, 'POST', `/api/v1/organizationUser/${seat.id}/integrations`, body()))
        .status,
    ).toBe(201);
    const { entity: owned } = await createIntegration({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: seat.userId,
      role: 'viewer',
    });
    expect(await holds(rawKey, 'integration', owned.id, 'manage')).toBe(true);
  });

  it("a viewer's full user token does not add one", async () => {
    const { entity: seat, context } = await createOrganizationUser(
      { role: 'viewer' },
      { organization },
    );
    const { rawKey } = await createKeyedToken(
      { ownerModel: 'User', role: null, full: true },
      { user: context.user },
    );
    expect(
      (await call(rawKey, 'POST', `/api/v1/organizationUser/${seat.id}/integrations`, body()))
        .status,
    ).toBe(403);
  });
});

describe('you mint a token of any role on your own user or member row: it holds your role or less (Aron, 2026-10-29)', () => {
  it('a member mints an owner token on their member row, and it holds only what the member holds', async () => {
    const { entity: seat, context } = await createOrganizationUser(
      { role: 'member' },
      { organization },
    );
    const { app } = createTestApp({
      mockUser: context.user,
      mockOrganizationUsers: [seat],
      mount: [(hono) => hono.route('/api/v1/organizationUser', organizationUserRouter)],
    });
    const response = await app.fetch(
      post(`/api/v1/organizationUser/${seat.id}/tokens`, { name: 'k', role: 'owner' }),
    );
    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: { key: string } };
    expect(await holds(data.key, 'organization', organization.id, 'operate')).toBe(true);
    expect(await holds(data.key, 'organization', organization.id, 'manage')).toBe(false);
  });
});

describe('acting as your member row: you hold it, so full on it is yours to set; the tenant still owns the row (R90)', () => {
  const asMember = async (role: Role) => {
    const { entity: seat, context } = await createOrganizationUser({ role }, { organization });
    const { app } = createTestApp({
      mockUser: context.user,
      mockOrganizationUsers: [seat],
      mount: [
        (hono) => hono.route('/api/v1/organizationUser', organizationUserRouter),
        (hono) => hono.route('/api/v1/integration', integrationRouter),
      ],
    });
    return { seat, app };
  };

  const mintsFull = async (role: Role) => {
    const { seat, app } = await asMember(role);
    const response = await app.fetch(
      post(`/api/v1/organizationUser/${seat.id}/tokens`, { name: 'k', full: true }),
    );
    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: { key: string } };
    return { seat, key: data.key };
  };

  it('a member mints a full token on their own member row: it is the member', async () => {
    const { seat, key } = await mintsFull('member');
    expect(await holds(key, 'organization', organization.id, 'operate')).toBe(true);
    expect(await holds(key, 'organization', organization.id, 'manage')).toBe(false);
    expect(await holds(key, 'organizationUser', seat.id, 'manage')).toBe(false);
    const { entity: owned } = await createIntegration({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: seat.userId,
      role: 'viewer',
    });
    expect(await holds(key, 'integration', owned.id, 'manage')).toBe(true);
  });

  it('a member manages their member integration directly', async () => {
    const { seat, app } = await asMember('member');
    const { entity: owned } = await createIntegration({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: seat.userId,
      role: 'viewer',
    });
    expect(
      (await app.fetch(patch(`/api/v1/integration/${owned.id}`, { name: 'renamed' }))).status,
    ).toBe(200);
  });

  it('a member manages their member integration through a full token on their row', async () => {
    const { seat, key } = await mintsFull('member');
    const { entity: owned } = await createIntegration({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: seat.userId,
      role: 'viewer',
    });
    expect(
      (await viaToken(key, 'PATCH', `/api/v1/integration/${owned.id}`, { name: 'renamed' })).status,
    ).toBe(200);
  });

  it('a viewer mints one too, and it only reads', async () => {
    const { key } = await mintsFull('viewer');
    expect(await holds(key, 'organization', organization.id, 'read')).toBe(true);
    expect(await holds(key, 'organization', organization.id, 'operate')).toBe(false);
  });

  it('a member adds a full integration on their own member row', async () => {
    const { seat, app } = await asMember('member');
    expect(
      (
        await app.fetch(
          post(`/api/v1/organizationUser/${seat.id}/integrations`, {
            name: `i-${crypto.randomUUID()}`,
            provider: 'slack',
            full: true,
          }),
        )
      ).status,
    ).toBe(201);
  });

  it("the organization's owner mints a full token on its integration: things the organization owns may be full (Aron, 2026-10-30)", async () => {
    const { app } = await asMember('owner');
    expect(
      (
        await app.fetch(
          post(`/api/v1/integration/${integrations.Organization.id}/tokens`, {
            name: 'k',
            full: true,
          }),
        )
      ).status,
    ).toBe(201);
  });
});

describe('a chain that ends at you is yours to write; a token carrying you keeps the checks (R91)', () => {
  it('a member gives their member integration an entitlement beyond their own; it holds only what the member holds', async () => {
    const { entity: seat, context } = await createOrganizationUser(
      { role: 'member' },
      { organization },
    );
    const { app } = createTestApp({
      mockUser: context.user,
      mockOrganizationUsers: [seat],
      mount: [(hono) => hono.route('/api/v1/organizationUser', organizationUserRouter)],
    });
    const response = await app.fetch(
      post(`/api/v1/organizationUser/${seat.id}/integrations`, {
        name: `i-${crypto.randomUUID()}`,
        provider: 'slack',
        role: 'viewer',
        entitlements: [
          {
            resource: 'db:organization',
            anchor: { resource: 'db:organization', id: organization.id },
            actions: { manage: true },
          },
        ],
      }),
    );
    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Integration };
    const { rawKey } = await createKeyedToken(
      { ownerModel: 'Integration', full: true, role: null },
      { integration: data },
    );
    expect(await holds(rawKey, 'organization', organization.id, 'operate')).toBe(true);
    expect(await holds(rawKey, 'organization', organization.id, 'manage')).toBe(false);
  });

  it("the organization's owner writes no entitlements on a member's integration, whatever its role (R91)", async () => {
    const { entity: seat } = await createOrganizationUser({ role: 'member' }, { organization });
    const { entity: owner, context } = await createOrganizationUser(
      { role: 'owner' },
      { organization },
    );
    const { app } = createTestApp({
      mockUser: context.user,
      mockOrganizationUsers: [owner],
      mount: [(hono) => hono.route('/api/v1/integration', integrationRouter)],
    });
    const add = {
      add: [
        {
          resource: 'db:organization',
          anchor: { resource: 'db:organization', id: organization.id },
          actions: { read: true },
        },
      ],
    };
    for (const role of [null, 'viewer'] as const) {
      const { entity: integration } = await createIntegration({
        ownerModel: 'OrganizationUser',
        organizationId: organization.id,
        userId: seat.userId,
        role,
      });
      expect(
        (await app.fetch(patch(`/api/v1/integration/${integration.id}/entitlements`, add))).status,
      ).toBe(403);
    }
  });
});

describe('a token on your member row acts as you only if it holds operate on the row; otherwise it is your personal org token (Aron, 2026-10-30)', () => {
  const memberWithIntegration = async () => {
    const { entity: seat } = await createOrganizationUser({ role: 'member' }, { organization });
    const { entity: owned } = await createIntegration({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: seat.userId,
      role: 'viewer',
    });
    return { seat, owned };
  };

  it('a full token on the row holds operate on it, and manages the member integration', async () => {
    const { seat, owned } = await memberWithIntegration();
    const { rawKey } = await createKeyedToken(
      { ownerModel: 'OrganizationUser', role: null, full: true },
      { organizationUser: seat },
    );
    expect(await holds(rawKey, 'organizationUser', seat.id, 'operate')).toBe(true);
    expect(await holds(rawKey, 'integration', owned.id, 'manage')).toBe(true);
  });

  it('a role token on the row is a personal org token: it acts at the org at its role and does nothing as the member', async () => {
    const { seat, owned } = await memberWithIntegration();
    const { rawKey } = await createKeyedToken(
      { ownerModel: 'OrganizationUser', role: 'member' },
      { organizationUser: seat },
    );
    expect(await holds(rawKey, 'organization', organization.id, 'operate')).toBe(true);
    expect(await holds(rawKey, 'organizationUser', seat.id, 'operate')).toBe(false);
    for (const action of actions)
      expect(await holds(rawKey, 'integration', owned.id, action)).toBe(false);
  });

  it('a role token given operate on the row by hand acts as the member: it manages the member integration', async () => {
    const { seat, owned } = await memberWithIntegration();
    const { rawKey } = await createKeyedToken(
      {
        ownerModel: 'OrganizationUser',
        role: 'member',
        entitlements: [entry('db:organizationUser', ['db:organizationUser', seat.id], ['operate'])],
      },
      { organizationUser: seat },
    );
    expect(await holds(rawKey, 'organizationUser', seat.id, 'operate')).toBe(true);
    expect(await holds(rawKey, 'integration', owned.id, 'manage')).toBe(true);
  });

  it("the same for a space member's row", async () => {
    const { entity: space } = await createSpace({}, { organization });
    const { context } = await createOrganizationUser({ role: 'member' }, { organization });
    const { entity: seat } = await createSpaceUser({ role: 'member' }, { ...context, space });
    const { entity: owned } = await createIntegration({
      ownerModel: 'SpaceUser',
      organizationId: organization.id,
      spaceId: space.id,
      userId: seat.userId,
      role: 'viewer',
    });
    const tokenOn = async (delegation: { role: Role | null; full?: boolean }) =>
      (await createKeyedToken({ ownerModel: 'SpaceUser', ...delegation }, { spaceUser: seat }))
        .rawKey;
    expect(
      await holds(await tokenOn({ role: null, full: true }), 'integration', owned.id, 'manage'),
    ).toBe(true);
    expect(await holds(await tokenOn({ role: 'member' }), 'integration', owned.id, 'read')).toBe(
      false,
    );
  });
});
