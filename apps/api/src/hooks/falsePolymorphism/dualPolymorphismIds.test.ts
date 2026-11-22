import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  db,
  dualPolymorphismIdConflicts,
  syncRuleReferenceEdges,
  withDualPolymorphismIds,
} from '@template/db';
import type { EmailComponent, Tag } from '@template/db/generated/client/client';
import { cleanupTouchedTables, createEmailComponent, createTag } from '@template/db/test';

describe('dual polymorphism ids', () => {
  let component: EmailComponent;
  let tag: Tag;
  let other: Tag;

  beforeEach(async () => {
    component = (await createEmailComponent()).entity;
    tag = (await createTag()).entity;
    other = (await createTag()).entity;
  });

  afterEach(async () => {
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

  it('a create writes each dual polymorphism id from its set typed FK', async () => {
    expect(await edge()).toMatchObject({ sourceId: component.id, targetId: tag.id });
    await clearEdges();
  });

  it('a create whose dual polymorphism id disagrees with its typed FK is a conflict', () => {
    const row = {
      sourceModel: 'EmailComponent',
      sourceEmailComponentId: component.id,
      targetModel: 'Tag',
      targetTagId: tag.id,
    };
    expect(dualPolymorphismIdConflicts('RuleReference', row)).toEqual([]);
    expect(dualPolymorphismIdConflicts('RuleReference', { ...row, targetId: other.id })).toEqual([
      `RuleReference.targetId must equal the Tag id ${tag.id}`,
    ]);
  });

  it('an update touching a typed FK or a dual polymorphism id is refused; a restamp is not', async () => {
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

  it('a composite arm takes its dual polymorphism id as written, with every key it carries', () => {
    const row = {
      sourceModel: 'Organization',
      sourceOrganizationId: 'o-1',
      targetModel: 'OrganizationUser',
      targetId: 'ou-1',
      targetOrganizationId: 'o-1',
      targetUserId: 'u-1',
    };
    expect(dualPolymorphismIdConflicts('Entitlement', row)).toEqual([]);
    expect(withDualPolymorphismIds('Entitlement', row)).toMatchObject({ targetId: 'ou-1' });
    expect(dualPolymorphismIdConflicts('Entitlement', { ...row, targetUserId: null })).toEqual([
      'Entitlement.targetId names a OrganizationUser; pass targetOrganizationId, targetUserId',
    ]);
  });

  it('a composite arm with its own id column takes its dual polymorphism id from it: an Inquiry Space party', () => {
    const row = {
      sourceModel: 'Space',
      sourceOrganizationId: 'o-1',
      sourceSpaceId: 's-1',
      targetModel: 'admin',
    };
    expect(withDualPolymorphismIds('Inquiry', row)).toMatchObject({ sourceId: 's-1' });
    expect(withDualPolymorphismIds('Inquiry', row)).not.toHaveProperty('targetId');
    expect(dualPolymorphismIdConflicts('Inquiry', { ...row, sourceId: 'o-1' })).toEqual([
      'Inquiry.sourceId must equal the Space id s-1',
    ]);
  });

  it('an axis without a dual polymorphism id is left as written', () => {
    const row = { ownerModel: 'User', userId: 'u-1', name: 'token' };
    expect(withDualPolymorphismIds('Token', row)).toEqual(row);
  });
});
