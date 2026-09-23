import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
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

describe('featureFlagVariant hook', () => {
  let organization: Organization;
  let audience: Segment;
  let flag: FeatureFlag;

  beforeAll(async () => {
    registerFeatureFlagVariantHook();
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

    const { entity: first } = await createFeatureFlagVariant({ segment: audience }, { featureFlag: flag });
    const { entity: internal } = await createSegment({
      ownerModel: ProviderModel.Organization,
      organization,
      featureFlagVariantId: first.id,
    });
    const own = await db.featureFlagVariant.update({ where: { id: first.id }, data: { segmentId: internal.id } });
    expect(own.segmentId).toBe(internal.id);

    await expect(createFeatureFlagVariant({ segment: internal }, { featureFlag: flag })).rejects.toThrow(
      "another variant's internal audience",
    );
  });
});
