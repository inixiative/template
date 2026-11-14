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
  const write = (lens: EntitlementInput['lens']) =>
    changeEntitlements(writer, target, {
      add: [
        {
          resource: 'Organization',
          actions: ['read'],
          sourceModel: 'Organization',
          sourceId: organization.id,
          lens,
        },
      ],
    });
  const organizationRows = () =>
    db.entitlement.count({
      where: { targetModel: 'OrganizationUser', targetId: member.id, resource: 'Organization' },
    });
  return { write, organizationRows };
};

describe('an entitlement lens always keeps id (Aron, 2026-11-14)', () => {
  it.each([
    ['the root omits id', { root: { omits: ['id'] } }, 'root'],
    ['the root picks without id', { root: { picks: ['name'] } }, 'root'],
    [
      'a nested relation picks without id',
      { root: { relations: { spaces: { picks: ['name'] } } } },
      'root.relations.spaces',
    ],
    [
      'a mapDefaults model omits id',
      { mapDefaults: { prisma: { models: { Space: { omits: ['id'] } } } } },
      'mapDefaults.prisma.models.Space',
    ],
  ])('refuses a lens where %s, writing nothing', async (_, lens, path) => {
    const { write, organizationRows } = await scene();
    await expect(write(lens)).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining(path),
    });
    expect(await organizationRows()).toBe(0);
  });

  it('accepts a lens that keeps id at every narrowing', async () => {
    const { write, organizationRows } = await scene();
    await write({
      root: { picks: ['id', 'name'], relations: { spaces: { omits: ['name'] } } },
      mapDefaults: { prisma: { models: { Space: { picks: ['id', 'slug'] } } } },
    });
    expect(await organizationRows()).toBe(1);
  });
});
