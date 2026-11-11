import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db, revive } from '@template/db';
import type { Organization, OrganizationUser } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
} from '@template/db/test';
import { memberSelfGrant, toEntitlementInput } from '@template/permissions';
import { registerImmutableFieldsHook } from '#/hooks/immutableFields/hook';
import { registerMemberSelfGrantHook } from '#/hooks/memberSelfGrant/hook';
import { registerRulesHook } from '#/hooks/rules/hook';
import { registerSoftDeleteCascadeHook } from '#/hooks/softDeleteCascade/hook';
import { heldEntitlements } from '#tests/utils/entitlements';

const onMember = (member: { id: string }) => ({
  model: 'OrganizationUser' as const,
  id: member.id,
});

const selfGrantRow = async (member: OrganizationUser) =>
  db.withDeleted(() =>
    db.entitlement.findFirstOrThrow({
      where: { targetModel: 'OrganizationUser', targetId: member.id },
    }),
  );

describe('every member row carries a self-grant to operate itself, and it cannot be removed (Aron, 2026-10-30)', () => {
  let organization: Organization;

  beforeEach(async () => {
    registerMemberSelfGrantHook();
    registerRulesHook();
    registerImmutableFieldsHook();
    registerSoftDeleteCascadeHook();
    ({ entity: organization } = await createOrganization());
  });

  afterEach(async () => {
    clearHookRegistry();
    await cleanupTouchedTables(db);
  });

  it('an organization member row is created with it, as a row', async () => {
    const { entity: member } = await createOrganizationUser({ role: 'member' }, { organization });
    expect(await heldEntitlements(onMember(member))).toEqual([
      toEntitlementInput(memberSelfGrant('db:organizationUser', member)),
    ]);
  });

  it('a space member row is created with it', async () => {
    const { entity: space } = await createSpace({}, { organization });
    const { entity: member } = await createSpaceUser({ role: 'member' }, { space, organization });
    expect(await heldEntitlements({ model: 'SpaceUser', id: member.id })).toEqual([
      toEntitlementInput(memberSelfGrant('db:spaceUser', member)),
    ]);
  });

  it('an upsert that creates the member writes it; one that updates writes nothing more', async () => {
    const { entity: other } = await createOrganizationUser({ role: 'member' }, { organization });
    const { entity: second } = await createOrganization();
    const upsert = () =>
      db.organizationUser.upsert({
        where: {
          organizationId_userId: { organizationId: second.id, userId: other.userId },
        },
        create: { organizationId: second.id, userId: other.userId, role: 'member' },
        update: { role: 'viewer' },
      });
    const created = await upsert();
    await upsert();
    expect(await heldEntitlements(onMember(created))).toEqual([
      toEntitlementInput(memberSelfGrant('db:organizationUser', created)),
    ]);
  });

  it('a write that drops it while the member lives is refused, by id or in bulk', async () => {
    const { entity: member } = await createOrganizationUser({ role: 'member' }, { organization });
    const row = await selfGrantRow(member);
    await expect(
      db.entitlement.update({ where: { id: row.id }, data: { deletedAt: new Date() } }),
    ).rejects.toThrow('a member keeps its self-grant');
    await expect(
      db.entitlement.updateManyAndReturn({
        where: { targetId: member.id },
        data: { deletedAt: new Date() },
      }),
    ).rejects.toThrow('a member keeps its self-grant');
    expect((await selfGrantRow(member)).deletedAt).toBeNull();
  });

  it('a write that weakens it is refused: rows never change', async () => {
    const { entity: member } = await createOrganizationUser({ role: 'member' }, { organization });
    const row = await selfGrantRow(member);
    await expect(
      db.entitlement.update({ where: { id: row.id }, data: { actions: ['read'] } }),
    ).rejects.toThrow('Entitlement.actions cannot change after create');
  });

  it('it goes with its member and comes back with it', async () => {
    const { entity: member } = await createOrganizationUser({ role: 'member' }, { organization });
    const removedAt = new Date();
    await db.organizationUser.update({ where: { id: member.id }, data: { deletedAt: removedAt } });
    expect((await selfGrantRow(member)).deletedAt).toEqual(removedAt);

    await revive(db.organizationUser, { id: member.id });
    expect(await heldEntitlements(onMember(member))).toEqual([
      toEntitlementInput(memberSelfGrant('db:organizationUser', member)),
    ]);
  });

  it('a member created tombstoned carries its self-grant tombstoned with the same stamp', async () => {
    const { entity: other } = await createOrganizationUser({ role: 'member' }, { organization });
    const { entity: second } = await createOrganization();
    const heldAt = new Date();
    const [member] = await db.organizationUser.createManyAndReturn({
      data: [
        { organizationId: second.id, userId: other.userId, role: 'member', deletedAt: heldAt },
      ],
    });
    expect((await selfGrantRow(member!)).deletedAt).toEqual(heldAt);
  });
});
