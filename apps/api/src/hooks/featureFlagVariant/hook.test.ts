import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db, revive } from '@template/db';
import type { FeatureFlag, Organization, Segment } from '@template/db/generated/client/client';
import { FeatureFlagValueType, ProviderModel } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createFeatureFlag,
  createFeatureFlagVariant,
  createOrganization,
  createSegment,
} from '@template/db/test';
import { registerFeatureFlagVariantHook } from '#/hooks/featureFlagVariant/hook';
import { registerSoftDeleteCascadeHook } from '#/hooks/softDeleteCascade/hook';

describe('featureFlagVariant hook', () => {
  let organization: Organization;
  let audience: Segment;
  let flag: FeatureFlag;

  beforeAll(async () => {
    registerFeatureFlagVariantHook();
    registerSoftDeleteCascadeHook();
    organization = (await createOrganization()).entity;
    audience = (await createSegment({ ownerModel: ProviderModel.Organization, organization })).entity;
    flag = (await createFeatureFlag({ slug: 'custom:theme', ownerModel: ProviderModel.Organization, organization }))
      .entity;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  it('a rule row names a segment; the default row names none', async () => {
    await expect(createFeatureFlagVariant({}, { featureFlag: flag })).rejects.toThrow('names the segment it serves');
    await expect(
      createFeatureFlagVariant({ isDefault: true, segment: audience }, { featureFlag: flag }),
    ).rejects.toThrow('default variant has no segment');
    const { entity } = await createFeatureFlagVariant(
      { isDefault: true, label: 'off', valueBoolean: false },
      { featureFlag: flag },
    );
    expect(entity.isDefault).toBe(true);
  });

  it('exactly the value column matching the flag’s type is set', async () => {
    await expect(
      createFeatureFlagVariant({ segment: audience, valueBoolean: null, valueText: 'compact' }, { featureFlag: flag }),
    ).rejects.toThrow("a boolean flag's variant sets valueBoolean");
    await expect(
      createFeatureFlagVariant({ segment: audience, valueBoolean: true, valueNumber: 3 }, { featureFlag: flag }),
    ).rejects.toThrow('no other value column');

    const { entity: numeric } = await createFeatureFlag({
      slug: 'custom:limit',
      ownerModel: ProviderModel.Organization,
      organization,
      valueType: FeatureFlagValueType.number,
    });
    const { entity } = await createFeatureFlagVariant(
      { segment: audience, valueBoolean: null, valueNumber: 50 },
      { featureFlag: numeric },
    );
    expect(entity.valueNumber).toBe(50);
  });

  it('the label is a slug', async () => {
    await expect(
      createFeatureFlagVariant({ label: 'Big Rollout', segment: audience }, { featureFlag: flag }),
    ).rejects.toThrow('label is a slug');
  });

  it('the audience is a live segment of the flag’s owner, and an internal one only its own', async () => {
    const { entity: theirs } = await createSegment({ ownerModel: ProviderModel.platform });
    await expect(createFeatureFlagVariant({ segment: theirs }, { featureFlag: flag })).rejects.toThrow(
      'not a live segment of this Organization',
    );

    const { entity: internal } = await createSegment({
      ownerModel: ProviderModel.Organization,
      organization,
      featureFlagInternal: true,
    });
    const { entity: own } = await createFeatureFlagVariant({ segment: internal }, { featureFlag: flag });
    expect(own.segmentId).toBe(internal.id);
    const kept = await db.featureFlagVariant.update({ where: { id: own.id }, data: { segmentId: internal.id } });
    expect(kept.segmentId).toBe(internal.id);

    await expect(createFeatureFlagVariant({ segment: internal }, { featureFlag: flag })).rejects.toThrow(
      "another variant's internal audience",
    );
  });

  it('a variant’s tombstone reaches its internal segment, revive brings it back, and a shared audience is untouched', async () => {
    const { entity: internal } = await createSegment({
      ownerModel: ProviderModel.Organization,
      organization,
      featureFlagInternal: true,
    });
    const { entity: variant } = await createFeatureFlagVariant({ segment: internal }, { featureFlag: flag });
    const { entity: shared } = await createFeatureFlagVariant({ segment: audience }, { featureFlag: flag });

    const deleted = await db.featureFlagVariant.update({ where: { id: variant.id }, data: { deletedAt: new Date() } });
    expect((await db.segment.findUnique({ where: { id: internal.id } }))?.deletedAt).toEqual(deleted.deletedAt);

    await db.featureFlagVariant.update({ where: { id: shared.id }, data: { deletedAt: new Date() } });
    expect((await db.segment.findUnique({ where: { id: audience.id } }))?.deletedAt).toBeNull();

    await revive(db.featureFlagVariant, { id: variant.id });
    expect((await db.segment.findUnique({ where: { id: internal.id } }))?.deletedAt).toBeNull();
  });

  it('a flag’s tombstone cascades through its variants to their internal segments with one timestamp', async () => {
    const { entity: doomed } = await createFeatureFlag({
      slug: 'custom:doomed',
      ownerModel: ProviderModel.Organization,
      organization,
    });
    const { entity: internal } = await createSegment({
      ownerModel: ProviderModel.Organization,
      organization,
      featureFlagInternal: true,
    });
    const { entity: variant } = await createFeatureFlagVariant({ segment: internal }, { featureFlag: doomed });

    const dead = await db.featureFlag.update({ where: { id: doomed.id }, data: { deletedAt: new Date() } });
    expect((await db.featureFlagVariant.findUnique({ where: { id: variant.id } }))?.deletedAt).toEqual(dead.deletedAt);
    expect((await db.segment.findUnique({ where: { id: internal.id } }))?.deletedAt).toEqual(dead.deletedAt);

    await revive(db.featureFlag, { id: doomed.id });
    expect((await db.featureFlagVariant.findUnique({ where: { id: variant.id } }))?.deletedAt).toBeNull();
    expect((await db.segment.findUnique({ where: { id: internal.id } }))?.deletedAt).toBeNull();
  });
});
