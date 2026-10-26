import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import {
  db,
  materializedIdConflicts,
  snapshotHookRegistry,
  syncRuleReferenceEdges,
  withMaterializedIds,
} from '@template/db';
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

  const edge = async () => {
    await db.txn(() =>
      syncRuleReferenceEdges({ model: 'EmailComponent', id: component.id }, [
        { model: 'Tag', id: tag.id },
      ]),
    );
    return db.ruleReference.findFirstOrThrow({
      where: { sourceEmailComponentId: component.id, targetTagId: tag.id },
    });
  };

  const clearEdges = () =>
    db.txn(() => syncRuleReferenceEdges({ model: 'EmailComponent', id: component.id }, []));

  it('a create writes each materialized column from its set typed FK', async () => {
    expect(await edge()).toMatchObject({ sourceId: component.id, targetId: tag.id });
    await clearEdges();
  });

  it('a create whose materialized column disagrees with its typed FK is a conflict', () => {
    const row = {
      sourceModel: 'EmailComponent',
      sourceEmailComponentId: component.id,
      targetModel: 'Tag',
      targetTagId: tag.id,
    };
    expect(materializedIdConflicts('RuleReference', row)).toEqual([]);
    expect(materializedIdConflicts('RuleReference', { ...row, targetId: other.id })).toEqual([
      `RuleReference.targetId must equal the Tag id ${tag.id}`,
    ]);
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
    await clearEdges();
  });

  it('an axis without a materialized column is left as written', () => {
    const row = { ownerModel: 'User', userId: 'u-1', name: 'token' };
    expect(withMaterializedIds('Token', row)).toEqual(row);
  });
});
