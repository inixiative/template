import { afterEach, describe, expect, it } from 'bun:test';
import { db, type EntitlementInput } from '@template/db';
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

const scene = async () => {
  const { entity: organization } = await createOrganization();
  const { context } = await createOrganizationUser({ role: 'owner' }, { organization });
  const { entity: member } = await createOrganizationUser({ role: 'member' }, { organization });
  const writer = await userPermissions(context.user.id);
  if (!writer) throw new Error('no writer');
  const target = { model: 'OrganizationUser' as const, id: member.id };
  const onOrganization = (lens?: EntitlementInput['lens']): EntitlementInput => ({
    resource: 'Organization',
    actions: ['read'],
    sourceModel: 'Organization',
    sourceId: organization.id,
    ...(lens !== undefined ? { lens } : {}),
  });
  const lensed = async () =>
    (
      await db.entitlement.findMany({
        where: { targetModel: 'OrganizationUser', targetId: member.id },
      })
    )
      .filter((row) => row.resource === 'Organization')
      .map((row) => row.lens);
  return { writer, target, onOrganization, lensed };
};

describe('an entitlement row keeps its lens', () => {
  it('stores the lens it was written with, and a different lens on the same grant is its own row', async () => {
    const { writer, target, onOrganization, lensed } = await scene();
    await changeEntitlements(writer, target, { add: [onOrganization({ fields: ['name'] })] });
    await changeEntitlements(writer, target, { add: [onOrganization({ fields: ['slug'] })] });
    expect(await lensed()).toEqual([{ fields: ['name'] }, { fields: ['slug'] }]);
  });

  it('a held row with no lens covers the same grant with a lens; a lensed row does not cover one without', async () => {
    const { writer, target, onOrganization, lensed } = await scene();
    await changeEntitlements(writer, target, { add: [onOrganization({ fields: ['name'] })] });
    await changeEntitlements(writer, target, { add: [onOrganization()] });
    await changeEntitlements(writer, target, { add: [onOrganization({ fields: ['slug'] })] });
    expect(await lensed()).toEqual([{ fields: ['name'] }, null]);
  });
});
