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
import { integrationRouter } from '#/modules/integration';
import { organizationRouter } from '#/modules/organization';
import { organizationUserRouter } from '#/modules/organizationUser';
import { tokenRouter } from '#/modules/token';
import { createTestApp } from '#tests/createTestApp';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { createTokenProbeApp } from '#tests/utils/createTokenProbeApp';
import type { Entry } from '#tests/utils/entitlementEntry';
import { del, post } from '#tests/utils/request';

const { holds } = createTokenProbeApp();

type Kind = 'Organization' | 'Space' | 'OrganizationUser' | 'SpaceUser';
const kinds: Kind[] = ['Organization', 'Space', 'OrganizationUser', 'SpaceUser'];
const actions = ['read', 'operate', 'manage', 'own', 'delete'] as const;

let organization: Organization;
const integrations = {} as Record<Kind, Integration>;

beforeAll(async () => {
  registerClearCacheHook();
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

describe("integrations under an organization: the owner reaches every kind, an admin the organization's own (R82, R83)", () => {
  it('the owner holds every action on all four kinds', async () => {
    const all = [...actions];
    expect(await reach(await seatKey('owner'))).toEqual({
      Organization: all,
      Space: all,
      OrganizationUser: all,
      SpaceUser: all,
    });
  });

  it("an admin holds the organization's own integrations, short of own, and nothing of a space's or a member's", async () => {
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

  it("the owner deletes any of them; an admin only the organization's own integration's tokens", async () => {
    for (const kind of kinds) {
      expect(await deletes('owner', kind)).toBe(204);
      expect(await deletes('admin', kind)).toBe(kind === 'Organization' ? 204 : 403);
    }
  });
});

describe("a member's own tokens reach that member's integrations, as far as their delegation goes (F2)", () => {
  const ownToken = async (role: Role) => {
    const { entity: seat } = await createOrganizationUser({ role: 'member' }, { organization });
    const { entity: integration } = await createIntegration({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: seat.userId,
      role: 'viewer',
    });
    const { rawKey } = await createKeyedToken(
      { ownerModel: 'OrganizationUser', role },
      { organizationUser: seat },
    );
    return { rawKey, integration };
  };

  it('a member-role token of the member reads and operates its integration', async () => {
    const { rawKey, integration } = await ownToken('member');
    expect(await holds(rawKey, 'integration', integration.id, 'read')).toBe(true);
    expect(await holds(rawKey, 'integration', integration.id, 'operate')).toBe(true);
  });

  it('a viewer-role token of the member reads it and does not operate it', async () => {
    const { rawKey, integration } = await ownToken('viewer');
    expect(await holds(rawKey, 'integration', integration.id, 'read')).toBe(true);
    expect(await holds(rawKey, 'integration', integration.id, 'operate')).toBe(false);
  });

  it("another member's token reaches nothing of it", async () => {
    const { integration } = await ownToken('member');
    const { rawKey } = await ownToken('member');
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

  it("an admin member's admin token adds one; a member token does not", async () => {
    expect(await addsOwnByToken('admin', 'admin')).toBe(201);
    expect(await addsOwnByToken('admin', 'member')).toBe(403);
  });

  it("a member's admin token adds one: the member owns their member integrations (R90)", async () => {
    expect(await addsOwnByToken('member', 'admin')).toBe(201);
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
    expect(await holds(rawKey, 'integration', owned.id, 'own')).toBe(true);
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

  it("a member's role token reaches the member's integrations at its role", async () => {
    const { entity: seat } = await createOrganizationUser({ role: 'member' }, { organization });
    const { rawKey } = await createKeyedToken(
      { ownerModel: 'OrganizationUser', role: 'member' },
      { organizationUser: seat },
    );
    const { entity: owned } = await createIntegration({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: seat.userId,
      role: 'viewer',
    });
    expect(await holds(rawKey, 'integration', owned.id, 'operate')).toBe(true);
    expect(await holds(rawKey, 'integration', owned.id, 'manage')).toBe(false);
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
    expect(await holds(key, 'integration', owned.id, 'own')).toBe(true);
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

  it("nobody holds an organization's integration, so not even the owner mints a full token on it", async () => {
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
    ).toBe(403);
  });
});
