import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db, type Prisma, unregisterDbHook } from '@template/db';
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
import { registerRulesHook } from '#/hooks/rules/hook';

const spaceManage = (spaceId: string) => ({
  resource: 'db:space',
  anchor: { resource: 'db:space', id: spaceId },
  actions: { manage: true },
});

describe('every member row carries a self-grant to operate itself, and it cannot be removed (Aron, 2026-10-30)', () => {
  let organization: Organization;

  beforeAll(async () => {
    registerMemberSelfGrantHook();
    registerRulesHook();
    ({ entity: organization } = await createOrganization());
  });

  afterAll(async () => {
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

  it('other entitlements are written beside it', async () => {
    const { entity: space } = await createSpace({}, { organization });
    const { entity: member } = await createOrganizationUser({ role: 'member' }, { organization });
    const self = memberSelfGrant('db:organizationUser', member) as Prisma.InputJsonObject;
    const updated = await db.organizationUser.update({
      where: { id: member.id },
      data: { entitlements: [spaceManage(space.id), self] },
    });
    expect(updated.entitlements as unknown).toEqual([spaceManage(space.id), self]);
  });

  it('a write that drops it is refused, by id, by the organization and user key, or in bulk (Aron, 2026-10-31)', async () => {
    const { entity: member } = await createOrganizationUser({ role: 'member' }, { organization });
    await expect(
      db.organizationUser.update({ where: { id: member.id }, data: { entitlements: [] } }),
    ).rejects.toThrow();
    await expect(
      db.organizationUser.update({
        where: {
          organizationId_userId: { organizationId: member.organizationId, userId: member.userId },
        },
        data: { entitlements: [] },
      }),
    ).rejects.toThrow();
    await expect(
      db.organizationUser.updateManyAndReturn({
        where: { id: member.id },
        data: { entitlements: [] },
      }),
    ).rejects.toThrow();
  });

  it("a write that weakens it, or swaps in another member's, is refused", async () => {
    const { entity: member } = await createOrganizationUser({ role: 'member' }, { organization });
    const { entity: other } = await createOrganizationUser({ role: 'member' }, { organization });
    const self = memberSelfGrant('db:organizationUser', member) as Prisma.InputJsonObject;
    await expect(
      db.organizationUser.update({
        where: { id: member.id },
        data: { entitlements: [{ ...self, actions: { read: true } }] },
      }),
    ).rejects.toThrow();
    await expect(
      db.organizationUser.update({
        where: { id: member.id },
        data: {
          entitlements: [memberSelfGrant('db:organizationUser', other) as Prisma.InputJsonObject],
        },
      }),
    ).rejects.toThrow();
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
