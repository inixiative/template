import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import type { Organization, Space } from '@template/db/generated/client/client';
import { ProviderModel } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createFeatureFlag,
  createFeatureFlagVariant,
  createOrganization,
  createSegment,
  createSpace,
} from '@template/db/test';
import { registerFeatureFlagHook } from '#/hooks/featureFlag/hook';

describe('featureFlag hook', () => {
  let organization: Organization;
  let space: Space;

  beforeAll(async () => {
    registerFeatureFlagHook();
    organization = (await createOrganization()).entity;
    space = (await createSpace({}, { organization })).entity;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  it('only the platform defines a bare slug; every owner may define custom: ones', async () => {
    await expect(
      createFeatureFlag({ slug: 'dark-mode', ownerModel: ProviderModel.Organization, organization }),
    ).rejects.toThrow('prefix yours with custom:');
    const { entity: custom } = await createFeatureFlag({
      slug: 'custom:dark-mode',
      ownerModel: ProviderModel.Organization,
      organization,
    });
    expect(custom.slug).toBe('custom:dark-mode');
    const { entity: bare } = await createFeatureFlag({ slug: 'dark-mode' });
    expect(bare.ownerModel).toBe('platform');
  });

  it('refuses a slug outside the shape', async () => {
    for (const slug of ['Dark Mode', 'dark--mode', 'rollout:dark-mode', 'custom:']) {
      await expect(createFeatureFlag({ slug })).rejects.toThrow('optionally prefixed custom:');
    }
  });

  it('the gate segment must be a live segment of the same owner and nobody’s internal audience', async () => {
    const { entity: theirs } = await createSegment({ ownerModel: ProviderModel.Space, space });
    await expect(
      createFeatureFlag({
        slug: 'custom:gated',
        ownerModel: ProviderModel.Organization,
        organization,
        segment: theirs,
      }),
    ).rejects.toThrow('not a live segment of this Organization');

    const { entity: ours } = await createSegment({ ownerModel: ProviderModel.Organization, organization });
    const { entity: gated } = await createFeatureFlag({
      slug: 'custom:gated',
      ownerModel: ProviderModel.Organization,
      organization,
      segment: ours,
    });
    expect(gated.segmentId).toBe(ours.id);

    const { entity: variant } = await createFeatureFlagVariant({ segment: ours }, { featureFlag: gated });
    const { entity: internal } = await createSegment({
      ownerModel: ProviderModel.Organization,
      organization,
      featureFlagVariantId: variant.id,
    });
    await expect(
      createFeatureFlag({
        slug: 'custom:other',
        ownerModel: ProviderModel.Organization,
        organization,
        segment: internal,
      }),
    ).rejects.toThrow("another variant's internal audience");
  });
});
