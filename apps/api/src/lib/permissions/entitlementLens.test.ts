import { afterEach, describe, expect, it } from 'bun:test';
import { db, type EntitlementInput, revive } from '@template/db';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
} from '@template/db/test';
import { changeEntitlements } from '#/lib/permissions/changeEntitlements';
import { userPermissions } from '#/lib/permissions/userPermissions';

afterEach(async () => {
  await cleanupTouchedTables(db);
});

type Grant = {
  actions?: string[];
  where?: EntitlementInput['where'];
  lens?: EntitlementInput['lens'];
};

const scene = async () => {
  const { entity: organization } = await createOrganization();
  const { context } = await createOrganizationUser({ role: 'owner' }, { organization });
  const { entity: member } = await createOrganizationUser({ role: 'member' }, { organization });
  const writer = await userPermissions(context.user.id);
  if (!writer) throw new Error('no writer');
  const target = { model: 'OrganizationUser' as const, id: member.id };
  const onOrganization = ({ actions = ['read'], where, lens }: Grant = {}): EntitlementInput => ({
    resource: 'Organization',
    actions,
    sourceModel: 'Organization',
    sourceId: organization.id,
    ...(where !== undefined ? { where } : {}),
    ...(lens !== undefined ? { lens } : {}),
  });
  const write = (...add: EntitlementInput[]) => changeEntitlements(writer, target, { add });
  const rows = async () =>
    (
      await db.withDeleted(() =>
        db.entitlement.findMany({
          where: { targetModel: 'OrganizationUser', targetId: member.id, resource: 'Organization' },
          orderBy: { createdAt: 'asc' },
        }),
      )
    ).map((row) => ({
      actions: row.actions,
      ...(row.where != null ? { where: row.where } : {}),
      lens: row.lens,
      live: row.deletedAt == null,
    }));
  const live = async () => (await rows()).filter((row) => row.live);
  return { member, onOrganization, write, rows, live };
};

describe('one lens per entitlement: an equal entitlement with a new lens replaces the held row (Aron, 2026-11-12)', () => {
  it('a lens change tombstones the old row and leaves one live row with the new lens', async () => {
    const { onOrganization, write, rows } = await scene();
    await write(onOrganization({ lens: { fields: ['name'] } }));
    await write(onOrganization({ lens: { fields: ['slug'] } }));
    expect(await rows()).toEqual([
      { actions: ['read'], lens: { fields: ['name'] }, live: false },
      { actions: ['read'], lens: { fields: ['slug'] }, live: true },
    ]);
  });

  it('the same lens again is skipped', async () => {
    const { onOrganization, write, rows } = await scene();
    await write(onOrganization({ lens: { fields: ['name'] } }));
    await write(onOrganization({ lens: { fields: ['name'] } }));
    expect(await rows()).toEqual([{ actions: ['read'], lens: { fields: ['name'] }, live: true }]);
  });

  it('no lens to a lens replaces, and a lens to no lens replaces', async () => {
    const { onOrganization, write, rows } = await scene();
    await write(onOrganization());
    await write(onOrganization({ lens: { fields: ['name'] } }));
    await write(onOrganization());
    expect(await rows()).toEqual([
      { actions: ['read'], lens: null, live: false },
      { actions: ['read'], lens: { fields: ['name'] }, live: false },
      { actions: ['read'], lens: null, live: true },
    ]);
  });

  it('of equal entries in one write, the last is the one written', async () => {
    const { onOrganization, write, rows } = await scene();
    await write(
      onOrganization({ lens: { fields: ['name'] } }),
      onOrganization({ lens: { fields: ['slug'] } }),
    );
    expect(await rows()).toEqual([{ actions: ['read'], lens: { fields: ['slug'] }, live: true }]);
  });

  it('different actions or a different where are not equal: coverage applies only from no lens or the same lens', async () => {
    const { onOrganization, write, live } = await scene();
    const name = { fields: ['name'] };
    const named = { field: 'name', operator: 'equals', value: 'Acme' };
    await write(onOrganization({ actions: ['operate', 'read'], lens: name }));
    await write(onOrganization({ lens: name }));
    expect(await live()).toEqual([{ actions: ['operate', 'read'], lens: name, live: true }]);

    await write(onOrganization({ lens: { fields: ['slug'] } }));
    await write(
      onOrganization({ actions: ['operate', 'read'], where: named, lens: { fields: ['slug'] } }),
    );
    await write(onOrganization({ actions: ['read'], where: named, lens: { fields: ['slug'] } }));
    expect(await live()).toEqual([
      { actions: ['operate', 'read'], lens: name, live: true },
      { actions: ['read'], lens: { fields: ['slug'] }, live: true },
      { actions: ['operate', 'read'], where: named, lens: { fields: ['slug'] }, live: true },
    ]);
  });

  it('the same grant with a where of its own and another lens is its own row, beside the held one', async () => {
    const { onOrganization, write, live } = await scene();
    const named = { field: 'name', operator: 'equals', value: 'Acme' };
    await write(onOrganization({ lens: { fields: ['name'] } }));
    await write(onOrganization({ where: named, lens: { fields: ['slug'] } }));
    expect(await live()).toEqual([
      { actions: ['read'], lens: { fields: ['name'] }, live: true },
      { actions: ['read'], where: named, lens: { fields: ['slug'] }, live: true },
    ]);
  });

  it('a replace whose new entry a broader held row with its lens covers only tombstones the old row', async () => {
    const { onOrganization, write, rows } = await scene();
    await write(onOrganization({ lens: { fields: ['name'] } }));
    await write(onOrganization({ actions: ['operate', 'read'], lens: { fields: ['slug'] } }));
    await write(onOrganization({ lens: { fields: ['slug'] } }));
    expect(await rows()).toEqual([
      { actions: ['read'], lens: { fields: ['name'] }, live: false },
      { actions: ['operate', 'read'], lens: { fields: ['slug'] }, live: true },
    ]);
  });

  it('a held row with no lens covers a narrower entry with a lens: no lens is the full surface', async () => {
    const { onOrganization, write, live } = await scene();
    await write(onOrganization({ actions: ['operate', 'read'] }));
    await write(onOrganization({ lens: { fields: ['name'] } }));
    expect(await live()).toEqual([{ actions: ['operate', 'read'], lens: null, live: true }]);
  });

  it('a held row with a lens does not cover a narrower entry with no lens', async () => {
    const { onOrganization, write, live } = await scene();
    await write(onOrganization({ actions: ['operate', 'read'], lens: { fields: ['name'] } }));
    await write(onOrganization());
    expect(await live()).toEqual([
      { actions: ['operate', 'read'], lens: { fields: ['name'] }, live: true },
      { actions: ['read'], lens: null, live: true },
    ]);
  });

  it('reviving the holder brings back only the new-lens row; the replaced row stays tombstoned', async () => {
    const { member, onOrganization, write, rows } = await scene();
    await write(onOrganization({ lens: { fields: ['name'] } }));
    await write(onOrganization({ lens: { fields: ['slug'] } }));
    await db.organizationUser.update({ where: { id: member.id }, data: { deletedAt: new Date() } });
    expect((await rows()).map((row) => row.live)).toEqual([false, false]);

    await revive(db.organizationUser, { id: member.id });
    expect(await rows()).toEqual([
      { actions: ['read'], lens: { fields: ['name'] }, live: false },
      { actions: ['read'], lens: { fields: ['slug'] }, live: true },
    ]);
  });
});
