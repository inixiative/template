import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db, snapshotHookRegistry, withMaterializedIds } from '@template/db';
import type { EmailComponent, Tag } from '@template/db/generated/client/client';
import { cleanupTouchedTables, createEmailComponent, createTag } from '@template/db/test';
import { registerImmutableFieldsHook } from '#/hooks/immutableFields/hook';
import { registerRulesHook } from '#/hooks/rules/hook';

describe('materialized ids on a false-polymorphic axis', () => {
  let component: EmailComponent;
  let tag: Tag;
  let other: Tag;
  let restoreHooks: () => void;

  beforeAll(async () => {
    restoreHooks = snapshotHookRegistry();
    registerRulesHook();
    registerImmutableFieldsHook();
    component = (await createEmailComponent()).entity;
    tag = (await createTag()).entity;
    other = (await createTag()).entity;
  });

  afterAll(async () => {
    restoreHooks();
    await cleanupTouchedTables(db);
  });

  const edge = (extra: Record<string, unknown> = {}) =>
    db.ruleReference.create({
      data: {
        sourceModel: 'EmailComponent',
        sourceEmailComponentId: component.id,
        targetModel: 'Tag',
        targetTagId: tag.id,
        ...extra,
      } as never,
    });

  it('a create writes each materialized column from its set typed FK', async () => {
    const created = await edge();
    expect(created).toMatchObject({ sourceId: component.id, targetId: tag.id });
    await db.ruleReference.delete({ where: { id: created.id } });
  });

  it('a create whose materialized column disagrees with its typed FK is refused', async () => {
    await expect(edge({ targetId: other.id })).rejects.toMatchObject({ status: 422 });
  });

  it('an update touching a typed FK or a materialized column is refused; a restamp is not', async () => {
    const created = await edge();
    await expect(
      db.ruleReference.update({ where: { id: created.id }, data: { targetTagId: other.id } }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      db.ruleReference.update({ where: { id: created.id }, data: { targetId: other.id } }),
    ).rejects.toMatchObject({ status: 422 });

    const stamp = new Date('2026-10-01T00:00:00Z');
    const restamped = await db.ruleReference.update({
      where: { id: created.id },
      data: { targetDeletedAt: stamp },
    });
    expect(restamped).toMatchObject({ targetId: tag.id, targetDeletedAt: stamp });
    await db.ruleReference.delete({ where: { id: created.id } });
  });

  it('an axis without a materialized column is left as written', () => {
    const row = { ownerModel: 'User', userId: 'u-1', name: 'token' };
    expect(withMaterializedIds('Token', row)).toEqual(row);
  });
});
