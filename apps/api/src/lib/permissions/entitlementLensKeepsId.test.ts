import { afterEach, describe, expect, it } from 'bun:test';
import { db, type EntitlementInput } from '@template/db';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  storeEntitlements,
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
  const onOrganization = (lens: unknown): EntitlementInput => ({
    resource: 'Organization',
    actions: ['read'],
    sourceModel: 'Organization',
    sourceId: organization.id,
    lens: lens as EntitlementInput['lens'],
  });
  const write = (lens: unknown) =>
    changeEntitlements(writer, target, { add: [onOrganization(lens)] });
  const store = (lens: unknown) =>
    storeEntitlements({ model: 'OrganizationUser', row: member }, [onOrganization(lens)]);
  const lenses = async () =>
    (
      await db.entitlement.findMany({
        where: { targetModel: 'OrganizationUser', targetId: member.id, resource: 'Organization' },
      })
    ).map((row) => row.lens);
  return { write, store, lenses };
};

const dropping: [string, unknown, string][] = [
  ['the root omits id', { root: { omits: ['id'] } }, 'Organization'],
  ['the root picks without id', { root: { picks: ['name'] } }, 'Organization'],
  [
    'a nested relation picks without id',
    { root: { relations: { spaces: { picks: ['name'] } } } },
    'Organization.spaces',
  ],
  [
    'a mapDefaults model omits id',
    { mapDefaults: { prisma: { models: { Space: { omits: ['id'] } } } } },
    'mapDefaults.prisma.models.Space',
  ],
];

const malformed: [string, unknown, string][] = [
  ['picks is a string', { root: { picks: 'name' } }, 'root.picks'],
  ['a relation is unknown', { root: { relations: { notARelation: {} } } }, 'root.relations'],
  ['a relation narrowing is null', { root: { relations: { spaces: null } } }, 'not an object'],
  ['a map default is null', { mapDefaults: { prisma: null } }, 'not an object'],
  ['the lens is not an object', ['id'], 'not an object'],
];

describe('an entitlement lens always keeps id (Aron, 2026-11-14)', () => {
  it.each(
    dropping,
  )('the writer refuses a lens where %s, writing nothing', async (_, lens, path) => {
    const { write, lenses } = await scene();
    await expect(write(lens)).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining(`${path} does not show it`),
    });
    expect(await lenses()).toEqual([]);
  });

  it.each(dropping)('a direct create is refused too, where %s', async (_, lens, path) => {
    const { store, lenses } = await scene();
    await expect(store(lens)).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining(path),
    });
    expect(await lenses()).toEqual([]);
  });

  it.each(malformed)('a malformed lens is a 422, never a 500: %s', async (_, lens, detail) => {
    const { write, lenses } = await scene();
    await expect(write(lens)).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining(detail),
    });
    expect(await lenses()).toEqual([]);
  });

  it('stores a lens that keeps id at every narrowing, as given', async () => {
    const { write, lenses } = await scene();
    const lens = {
      root: { picks: ['id', 'name'], relations: { spaces: { omits: ['slug'] } } },
      mapDefaults: { prisma: { models: { Space: { picks: ['id', 'name', 'slug'] } } } },
    };
    await write(lens);
    expect(await lenses()).toEqual([lens]);
  });
});
