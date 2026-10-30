import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db, unregisterDbHook } from '@template/db';
import type { Organization } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
} from '@template/db/test';
import { registerMemberSelfGrantHook } from '#/hooks/memberSelfGrant/hook';

const selfGrant = (
  resource: 'db:organizationUser' | 'db:spaceUser',
  member: { id: string; userId: string },
) => ({
  resource,
  anchor: { resource: 'db:user', id: member.userId, path: 'user' },
  where: { field: 'id', operator: 'equals', value: member.id },
  actions: { operate: true },
});

const spaceManage = (spaceId: string) => ({
  resource: 'db:space',
  anchor: { resource: 'db:space', id: spaceId },
  actions: { manage: true },
});

describe('every member row carries a self-grant to operate itself, and it cannot be removed (Aron, 2026-10-30)', () => {
  let organization: Organization;

  beforeAll(async () => {
    registerMemberSelfGrantHook();
    ({ entity: organization } = await createOrganization());
  });

  afterAll(async () => {
    unregisterDbHook('memberSelfGrant');
    await cleanupTouchedTables(db);
  });

  it('an organization member row is created with it', async () => {
    const { entity: member } = await createOrganizationUser({ role: 'member' }, { organization });
    const stored = await db.organizationUser.findUniqueOrThrow({ where: { id: member.id } });
    expect(stored.entitlements).toEqual([selfGrant('db:organizationUser', member)]);
  });

  it('a space member row is created with it', async () => {
    const { entity: space } = await createSpace({}, { organization });
    const { entity: member } = await createSpaceUser({ role: 'member' }, { space });
    const stored = await db.spaceUser.findUniqueOrThrow({ where: { id: member.id } });
    expect(stored.entitlements).toEqual([selfGrant('db:spaceUser', member)]);
  });

  it('writing entitlements without it keeps it beside the ones written', async () => {
    const { entity: space } = await createSpace({}, { organization });
    const { entity: member } = await createOrganizationUser({ role: 'member' }, { organization });
    const updated = await db.organizationUser.update({
      where: { id: member.id },
      data: { entitlements: [spaceManage(space.id)] },
    });
    expect(updated.entitlements).toEqual([
      spaceManage(space.id),
      selfGrant('db:organizationUser', member),
    ]);
  });

  it('clearing entitlements keeps it', async () => {
    const { entity: member } = await createOrganizationUser({ role: 'member' }, { organization });
    const updated = await db.organizationUser.update({
      where: { id: member.id },
      data: { entitlements: [] },
    });
    expect(updated.entitlements).toEqual([selfGrant('db:organizationUser', member)]);
  });
});
