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
import { memberSelfGrant } from '@template/permissions';
import { registerMemberSelfGrantHook } from '#/hooks/memberSelfGrant/hook';

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
    expect(stored.entitlements as unknown).toEqual([
      memberSelfGrant('db:organizationUser', member),
    ]);
  });

  it('a space member row is created with it', async () => {
    const { entity: space } = await createSpace({}, { organization });
    const { entity: member } = await createSpaceUser({ role: 'member' }, { space });
    const stored = await db.spaceUser.findUniqueOrThrow({ where: { id: member.id } });
    expect(stored.entitlements as unknown).toEqual([memberSelfGrant('db:spaceUser', member)]);
  });

  it('writing entitlements without it keeps it beside the ones written', async () => {
    const { entity: space } = await createSpace({}, { organization });
    const { entity: member } = await createOrganizationUser({ role: 'member' }, { organization });
    const updated = await db.organizationUser.update({
      where: { id: member.id },
      data: { entitlements: [spaceManage(space.id)] },
    });
    expect(updated.entitlements as unknown).toEqual([
      spaceManage(space.id),
      memberSelfGrant('db:organizationUser', member),
    ]);
  });

  it('clearing entitlements keeps it', async () => {
    const { entity: member } = await createOrganizationUser({ role: 'member' }, { organization });
    const updated = await db.organizationUser.update({
      where: { id: member.id },
      data: { entitlements: [] },
    });
    expect(updated.entitlements as unknown).toEqual([
      memberSelfGrant('db:organizationUser', member),
    ]);
  });

  it('clearing entitlements through the organization and user key keeps it', async () => {
    const { entity: member } = await createOrganizationUser({ role: 'member' }, { organization });
    const updated = await db.organizationUser.update({
      where: {
        organizationId_userId: { organizationId: member.organizationId, userId: member.userId },
      },
      data: { entitlements: [] },
    });
    expect(updated.entitlements as unknown).toEqual([
      memberSelfGrant('db:organizationUser', member),
    ]);
  });

  it('an upsert that creates the member writes it', async () => {
    const { entity: other } = await createOrganizationUser({ role: 'member' }, { organization });
    const { entity: second } = await createOrganization();
    const created = await db.organizationUser.upsert({
      where: {
        organizationId_userId: { organizationId: second.id, userId: other.userId },
      },
      create: { organizationId: second.id, userId: other.userId, role: 'member' },
      update: { entitlements: [] },
    });
    expect(created.entitlements as unknown).toEqual([
      memberSelfGrant('db:organizationUser', created),
    ]);
  });
});
