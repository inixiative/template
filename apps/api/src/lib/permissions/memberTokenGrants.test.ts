import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db, unregisterDbHook } from '@template/db';
import type { Organization, Role, Space } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
} from '@template/db/test';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { createTokenProbeApp } from '#tests/utils/createTokenProbeApp';
import { type Entry, entry } from '#tests/utils/entitlementEntry';

const { app, call, holds } = createTokenProbeApp((hono) => {
  hono.get('/grants', (c) => c.json(c.get('permix').getJSON()));
  hono.route('/api/v1/me', meRouter);
  hono.route('/api/v1/organization', organizationRouter);
});

const grantsFor = async (rawKey: string) => {
  const response = await app.request('/grants', {
    headers: { authorization: `Bearer ${rawKey}` },
  });
  expect(response.status).toBe(200);
  const grants = (await response.json()) as Record<string, Record<string, boolean>>;
  return Object.fromEntries(
    Object.entries(grants).map(([key, actions]) => [
      key,
      Object.keys(actions).filter((action) => actions[action]),
    ]),
  );
};

let organization: Organization;
let space: Space;
let otherSpace: Space;

beforeAll(async () => {
  registerClearCacheHook();
  ({ entity: organization } = await createOrganization());
  ({ entity: space } = await createSpace({}, { organization }));
  const { entity: otherOrganization } = await createOrganization();
  ({ entity: otherSpace } = await createSpace({}, { organization: otherOrganization }));
});

afterAll(async () => {
  unregisterDbHook('clearCache');
  await cleanupTouchedTables(db);
});

const memberKey = async (
  memberRole: Role,
  token: { role: Role | null; full?: boolean },
  entitlements?: Entry[],
) => {
  const { entity: organizationUser } = await createOrganizationUser(
    { role: memberRole, entitlements },
    { organization },
  );
  const { rawKey } = await createKeyedToken(
    { ownerModel: 'OrganizationUser', ...token },
    { organizationUser },
  );
  return { rawKey, organizationUser };
};

const spaceUserKey = async (memberRole: Role, spaceRole: Role, tokenRole: Role) => {
  const { context } = await createOrganizationUser({ role: memberRole }, { organization });
  const { entity: spaceUser } = await createSpaceUser({ role: spaceRole }, { ...context, space });
  return (await createKeyedToken({ ownerModel: 'SpaceUser', role: tokenRole }, { spaceUser }))
    .rawKey;
};

describe('a member token holds its member row, never the user (template #210 7f651bcc)', () => {
  it('an OrganizationUser token: its org at its role, and nothing else', async () => {
    const { rawKey, organizationUser } = await memberKey('admin', { role: 'owner' });
    expect(await grantsFor(rawKey)).toEqual({});
    expect(await holds(rawKey, 'organization', organization.id, 'manage')).toBe(true);
    expect(await holds(rawKey, 'organization', organization.id, 'own')).toBe(false);
    expect(await holds(rawKey, 'user', organizationUser.userId, 'read')).toBe(false);
  });

  it('a SpaceUser token: its space at its role, and not the organization', async () => {
    const rawKey = await spaceUserKey('admin', 'owner', 'owner');
    expect(await grantsFor(rawKey)).toEqual({});
    expect(await holds(rawKey, 'space', space.id, 'own')).toBe(true);
    expect(await holds(rawKey, 'organization', organization.id, 'read')).toBe(false);
  });

  it('a SpaceUser token below its member row holds the lesser role', async () => {
    const rawKey = await spaceUserKey('owner', 'owner', 'viewer');
    expect(await holds(rawKey, 'space', space.id, 'read')).toBe(true);
    expect(await holds(rawKey, 'space', space.id, 'operate')).toBe(false);
  });

  it('a token create stored on a member mints nothing: minting is create on a token, and only a user mints', async () => {
    const { rawKey } = await memberKey('member', { role: null, full: true }, [
      entry('db:token', ['db:organization', organization.id], ['create']),
    ]);
    const response = await call(rawKey, 'POST', `/api/v1/organization/${organization.id}/tokens`, {
      name: 'k',
      role: 'viewer',
    });
    expect(response.status).toBe(403);
  });

  it('a SpaceUser token has no me: /me answers 401', async () => {
    const rawKey = await spaceUserKey('owner', 'member', 'member');
    expect((await call(rawKey, 'GET', '/api/v1/me')).status).toBe(401);
  });
});

describe('full skips one step at every link: token, integration, member (Aron, 2026-10-26)', () => {
  const chains = [
    {
      name: 'full token, full integration: the member',
      integration: { role: null, full: true },
      token: { role: null, full: true },
      holds: 'manage',
      lacks: 'own',
    },
    {
      name: 'full token, member integration: the integration',
      integration: { role: 'member', full: false },
      token: { role: null, full: true },
      holds: 'operate',
      lacks: 'manage',
    },
    {
      name: 'viewer token, full integration: viewer under the member',
      integration: { role: null, full: true },
      token: { role: 'viewer', full: false },
      holds: 'read',
      lacks: 'operate',
    },
    {
      name: 'viewer token, member integration: viewer under member under the member',
      integration: { role: 'member', full: false },
      token: { role: 'viewer', full: false },
      holds: 'read',
      lacks: 'operate',
    },
  ] as const;

  for (const row of chains)
    it(row.name, async () => {
      const { context } = await createOrganizationUser({ role: 'admin' }, { organization });
      const { entity: integration } = await createIntegration({
        ownerModel: 'OrganizationUser',
        organizationId: organization.id,
        userId: context.user.id,
        ...row.integration,
      });
      const { rawKey } = await createKeyedToken(
        { ownerModel: 'Integration', ...row.token },
        { integration },
      );
      expect(await holds(rawKey, 'organization', organization.id, row.holds)).toBe(true);
      expect(await holds(rawKey, 'organization', organization.id, row.lacks)).toBe(false);
    });
});

describe('a member token follows its member row as soon as the row changes', () => {
  it('a demoted member row takes its token down with it', async () => {
    const { rawKey, organizationUser } = await memberKey('admin', { role: 'admin' });
    expect(await holds(rawKey, 'organization', organization.id, 'manage')).toBe(true);
    await db.organizationUser.update({
      where: { id: organizationUser.id },
      data: { role: 'viewer' },
    });
    expect(await holds(rawKey, 'organization', organization.id, 'manage')).toBe(false);
  });
});

describe("a member's entitlements are owned by its organization (Aron, 2026-10-26)", () => {
  const entitledMember = async (anchor: Space) =>
    (
      await memberKey('viewer', { role: null, full: true }, [
        entry('db:space', ['db:space', anchor.id], ['operate']),
      ])
    ).rawKey;

  it('an entitlement inside the organization holds', async () => {
    const key = await entitledMember(space);
    expect(await holds(key, 'space', space.id, 'operate')).toBe(true);
    expect(await holds(key, 'space', space.id, 'manage')).toBe(false);
  });

  it('an entitlement anchored outside the organization holds nothing', async () => {
    const key = await entitledMember(otherSpace);
    expect(await holds(key, 'space', otherSpace.id, 'read')).toBe(false);
  });
});

describe("a member token keeps its member's entitlement's resource and anchor, narrowed to its role", () => {
  const tokenOn = async (tokenRole: 'member' | 'viewer') =>
    (
      await memberKey('viewer', { role: tokenRole }, [
        entry('db:space', ['db:organization', organization.id], ['operate']),
      ])
    ).rawKey;

  it('a member-role token operates the spaces its member was entitled to', async () => {
    expect(await holds(await tokenOn('member'), 'space', space.id, 'operate')).toBe(true);
  });

  it('a viewer-role token reads them and does not operate', async () => {
    const key = await tokenOn('viewer');
    expect(await holds(key, 'space', space.id, 'read')).toBe(true);
    expect(await holds(key, 'space', space.id, 'operate')).toBe(false);
  });
});

describe('what an integration entitlement from the organization reaches (2026-10-26)', () => {
  const fullMemberToken = async (role: Role, entitlements?: Entry[]) => {
    const { entity: organizationUser } = await createOrganizationUser(
      { role, entitlements },
      { organization },
    );
    const { rawKey } = await createKeyedToken(
      { ownerModel: 'OrganizationUser', full: true, role: null },
      { organizationUser },
    );
    return rawKey;
  };

  const spaceIntegration = async () =>
    (
      await createIntegration({
        ownerModel: 'Space',
        organizationId: organization.id,
        spaceId: space.id,
        role: 'viewer',
      })
    ).entity;

  const organizationIntegration = async () =>
    (
      await createIntegration({
        ownerModel: 'Organization',
        organizationId: organization.id,
        role: 'viewer',
      })
    ).entity;

  const fromOrganization = () =>
    fullMemberToken('viewer', [
      entry('db:integration', ['db:organization', organization.id], ['manage']),
    ]);

  it('manage on integrations from the organization reaches its own integrations', async () => {
    const integration = await organizationIntegration();
    expect(await holds(await fromOrganization(), 'integration', integration.id, 'manage')).toBe(
      true,
    );
  });

  it("it does not reach a space's integrations: an anchor acts at its direct children (R55)", async () => {
    const integration = await spaceIntegration();
    expect(await holds(await fromOrganization(), 'integration', integration.id, 'manage')).toBe(
      false,
    );
  });

  it('an org admin does not manage a space-owned integration', async () => {
    const key = await fullMemberToken('admin');
    const integration = await spaceIntegration();
    expect(await holds(key, 'integration', integration.id, 'manage')).toBe(false);
  });
});
