import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import type { CustomerRef, FeatureFlag, Segment, User } from '@template/db/generated/client/client';
import { CustomerModel, FeatureFlagValueType, ProviderModel } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createCustomerRef,
  createFeatureFlag,
  createFeatureFlagVariant,
  createOrganization,
  createSegment,
  createSegmentMember,
  createUser,
  getNextSeq,
} from '@template/db/test';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { checkFlag } from '#/modules/featureFlag/services/checkFlag';
import { resolveFlags } from '#/modules/featureFlag/services/resolveFlags';
import { bucketOf } from '#/modules/segment/lib/sample';

const slug = (base: string) => `${base}-${getNextSeq()}`;

describe('resolveFlags', () => {
  let user: User;
  let ref: CustomerRef;
  let everyone: Segment;
  let beta: Segment;

  const platformSegment = async () => (await createSegment({ ownerModel: ProviderModel.platform })).entity;
  const flagFor = (ref: CustomerRef) => resolveFlags([ref]);
  const check = async <T extends FeatureFlagValueType>(flag: FeatureFlag, type: T, subject = ref) =>
    checkFlag('platform', flag.slug, type, await flagFor(subject));

  beforeAll(async () => {
    registerClearCacheHook();
    user = (await createUser()).entity;
    ref = (await createCustomerRef({ customerModel: 'User', providerModel: 'platform', customerUser: user })).entity;
    everyone = await platformSegment();
    beta = await platformSegment();
    await createSegmentMember({}, { segment: everyone, customerRef: ref });
    await createSegmentMember({}, { segment: beta, customerRef: ref });
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  it('walks variants in position order and the first membership wins; a reorder flips the overlap', async () => {
    const { entity: flag } = await createFeatureFlag({
      slug: slug('theme'),
      valueType: FeatureFlagValueType.string,
    });
    const { entity: broad } = await createFeatureFlagVariant(
      { label: 'broad', position: 1, segment: everyone, valueBoolean: null, valueText: 'classic' },
      { featureFlag: flag },
    );
    const { entity: narrow } = await createFeatureFlagVariant(
      { label: 'narrow', position: 2, segment: beta, valueBoolean: null, valueText: 'compact' },
      { featureFlag: flag },
    );
    expect(await check(flag, 'string')).toBe('classic');

    await db.featureFlagVariant.update({ where: { id: narrow.id }, data: { position: 0 } });
    expect(await check(flag, 'string')).toBe('compact');

    await db.featureFlagVariant.update({ where: { id: broad.id }, data: { position: -1 } });
    expect(await check(flag, 'string')).toBe('classic');
  });

  it('disabled serves the type’s zero, never the default variant; enabled with no match serves the default', async () => {
    const { entity: flag } = await createFeatureFlag({ slug: slug('kill'), enabled: false });
    await createFeatureFlagVariant({ label: 'default', isDefault: true, valueBoolean: true }, { featureFlag: flag });
    expect(await check(flag, 'boolean')).toBe(false);

    await db.featureFlag.update({ where: { id: flag.id }, data: { enabled: true } });
    expect(await check(flag, 'boolean')).toBe(true);
  });

  it('no match and no default is the zero of the type', async () => {
    const stranger = await platformSegment();
    const { entity: flag } = await createFeatureFlag({ slug: slug('limit'), valueType: FeatureFlagValueType.number });
    await createFeatureFlagVariant(
      { label: 'vip', segment: stranger, valueBoolean: null, valueNumber: 100 },
      { featureFlag: flag },
    );
    expect(await check(flag, 'number')).toBe(0);
  });

  it('the gate refuses non-members to the default, and admits members to the rules', async () => {
    const outside = await platformSegment();
    const { entity: gated } = await createFeatureFlag({ slug: slug('gated'), segment: outside });
    await createFeatureFlagVariant({ label: 'on', segment: everyone }, { featureFlag: gated });
    expect(await check(gated, 'boolean')).toBe(false);

    await db.featureFlag.update({ where: { id: gated.id }, data: { segmentId: beta.id } });
    expect(await check(gated, 'boolean')).toBe(true);
  });

  it('a member of the wrong customer kind is not addressed', async () => {
    const { entity: organization } = await createOrganization();
    const orgRef = (
      await createCustomerRef({
        customerModel: 'Organization',
        providerModel: 'platform',
        customerOrganization: organization,
      })
    ).entity;
    await createSegmentMember({}, { segment: everyone, customerRef: orgRef });
    const { entity: flag } = await createFeatureFlag({
      slug: slug('org-only'),
      subjectModel: CustomerModel.Organization,
    });
    await createFeatureFlagVariant({ label: 'on', segment: everyone }, { featureFlag: flag });

    expect(await check(flag, 'boolean')).toBeNull();
    expect(checkFlag('platform', flag.slug, 'boolean', await flagFor(orgRef))).toBe(true);
    expect(
      checkFlag('platform', flag.slug, 'boolean', await resolveFlags([ref, orgRef]), {
        customerModel: 'Organization',
        customerId: organization.id,
      }),
    ).toBe(true);
  });

  it('a soft-deleted segment no longer matches', async () => {
    const doomed = await platformSegment();
    await createSegmentMember({}, { segment: doomed, customerRef: ref });
    const { entity: flag } = await createFeatureFlag({ slug: slug('doomed') });
    await createFeatureFlagVariant({ label: 'on', segment: doomed }, { featureFlag: flag });
    expect(await check(flag, 'boolean')).toBe(true);

    await db.segment.update({ where: { id: doomed.id }, data: { deletedAt: new Date() } });
    expect(await check(flag, 'boolean')).toBe(false);
  });

  it('a missing flag or a reader asking for the wrong type gets null', async () => {
    const { entity: flag } = await createFeatureFlag({ slug: slug('typed') });
    await createFeatureFlagVariant({ label: 'on', segment: everyone }, { featureFlag: flag });
    expect(await check(flag, 'string')).toBeNull();
    expect(checkFlag('platform', 'never-defined', 'boolean', await flagFor(ref))).toBeNull();
  });

  it('json values come back as stored', async () => {
    const { entity: flag } = await createFeatureFlag({ slug: slug('layout'), valueType: FeatureFlagValueType.json });
    await createFeatureFlagVariant(
      { label: 'grid', segment: everyone, valueBoolean: null, valueJson: { columns: 3 } },
      { featureFlag: flag },
    );
    expect(await check(flag, 'json')).toEqual({ columns: 3 });
  });

  it("a sampled variant serves only the subjects whose id bucket sits in its range, at the flag's offset", async () => {
    const { entity: flag } = await createFeatureFlag({ slug: slug('sampled'), valueType: FeatureFlagValueType.string });
    const bucket = bucketOf(ref.id, flag.sampleOffset);
    const excluding = bucket < 50 ? { from: 50, to: 100 } : { from: 0, to: 50 };
    const including = bucket < 50 ? { from: 0, to: 50 } : { from: 50, to: 100 };
    const { entity: arm } = await createFeatureFlagVariant(
      { label: 'arm', position: 1, segment: everyone, valueBoolean: null, valueText: 'sampled', sample: excluding },
      { featureFlag: flag },
    );
    expect(await check(flag, FeatureFlagValueType.string)).toBe('');

    await db.featureFlagVariant.update({ where: { id: arm.id }, data: { sample: including } });
    expect(await check(flag, FeatureFlagValueType.string)).toBe('sampled');
  });
});
