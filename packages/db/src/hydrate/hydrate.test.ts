import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { TokenOwnerModel } from '@template/db/generated/client/enums';
import { fetchOne } from '@template/db/hydrate/fetchOne';
import { hydrate } from '@template/db/hydrate/hydrate';
import { cacheKey } from '@template/db/redis';
import {
  cleanupTouchedTables,
  createCustomerRef,
  createFeatureFlag,
  createFeatureFlagVariant,
  createOrganizationUser,
  createSegment,
  createSegmentMember,
  createSession,
  createToken,
  createUser,
  registerTestTracker,
} from '@template/db/test';

describe('hydrate', () => {
  beforeEach(() => {
    registerTestTracker();
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('hydrates single relation', async () => {
    const { entity: token, context } = await createToken({
      organizationUser: {},
      ownerModel: TokenOwnerModel.OrganizationUser,
    });

    const result = await hydrate(db, 'token', {
      id: token.id,
      userId: token.userId,
      organizationId: token.organizationId,
    });

    expect(result.user).toBeDefined();
    expect((result.user as { id: string }).id).toBe(context.user!.id);
    expect(result.organization).toBeDefined();
    expect((result.organization as { id: string }).id).toBe(context.organization!.id);
  });

  it('hydrates nested relations - token -> orgUser -> org', async () => {
    const { entity: token, context } = await createToken({
      organizationUser: {},
      ownerModel: TokenOwnerModel.OrganizationUser,
    });

    const result = await hydrate(db, 'token', {
      id: token.id,
      userId: token.userId,
      organizationId: token.organizationId,
    });

    // Token -> OrganizationUser (composite FK)
    expect(result.organizationUser).toBeDefined();
    const hydratedOrgUser = result.organizationUser as { organization: { id: string } };
    expect(hydratedOrgUser.organization).toBeDefined();
    expect(hydratedOrgUser.organization.id).toBe(context.organization!.id);
  });

  it('deduplicates fetches for same record', async () => {
    const { entity: token } = await createToken({
      organizationUser: {},
      ownerModel: TokenOwnerModel.OrganizationUser,
    });

    const pending = new Map();
    await hydrate(
      db,
      'token',
      {
        id: token.id,
        userId: token.userId,
        organizationId: token.organizationId,
      },
      pending,
    );

    // Organization accessed via token.organizationId - should only be in pending once
    // Cache key format: cache:organization:id:<value>
    const orgKeys = [...pending.keys()].filter((k) => k.includes(':organization:'));
    expect(orgKeys.length).toBe(1);
  });

  it('skips edges tagged @permissions(hydrate: false): a variant reaches its flag, never its audience', async () => {
    const { entity: flag } = await createFeatureFlag({});
    const { entity: audience } = await createSegment({ ownerModel: 'platform' });
    const { entity: variant } = await createFeatureFlagVariant({ segmentId: audience.id }, { featureFlag: flag });
    const { entity: internal } = await createSegment({ ownerModel: 'platform', featureFlagVariantId: variant.id });
    await db.featureFlagVariant.update({ where: { id: variant.id }, data: { segmentId: internal.id } });

    const hydratedVariant = await hydrate(db, 'featureFlagVariant', {
      id: variant.id,
      featureFlagId: flag.id,
      segmentId: internal.id,
    });
    expect((hydratedVariant.featureFlag as { id: string }).id).toBe(flag.id);
    expect(hydratedVariant.segment).toBeUndefined();

    const hydratedSegment = await hydrate(db, 'segment', { id: internal.id, featureFlagVariantId: variant.id });
    expect(hydratedSegment.internalToVariant).toBeUndefined();
  });

  it('a segment member reaches its segment and owner, never the customer reference', async () => {
    const { entity: segment } = await createSegment({ ownerModel: 'platform' });
    const { entity: customerRef } = await createCustomerRef({ customerModel: 'User', providerModel: 'platform' });
    const { entity: member } = await createSegmentMember({}, { segment, customerRef });

    const result = await hydrate(db, 'segmentMember', {
      id: member.id,
      segmentId: member.segmentId,
      customerRefId: member.customerRefId,
    });

    expect((result.segment as { id: string }).id).toBe(segment.id);
    expect(result.customerRef).toBeUndefined();
  });

  it('throws on a relation cycle instead of walking it', async () => {
    const { entity: session, context } = await createSession();

    await expect(
      hydrate(
        db,
        'session',
        { id: session.id, userId: session.userId },
        new Map(),
        new Set([cacheKey('user', context.user!.id)]),
      ),
    ).rejects.toThrow('Relation cycle while hydrating session.user');
  });

  it('handles null FK gracefully', async () => {
    const { entity: user } = await createUser();

    const result = await hydrate(db, 'user', { id: user.id });

    expect(result.id).toBe(user.id);
  });

  it('handles missing related record gracefully', async () => {
    const { entity: session, context } = await createSession();

    // Delete user to create orphan
    await db.user.delete({ where: { id: context.user!.id } });

    const result = await hydrate(db, 'session', { id: session.id, userId: session.userId });
    expect(result.user).toBeUndefined();
  });
});

describe('fetchOne', () => {
  beforeEach(() => {
    registerTestTracker();
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('fetches by simple id', async () => {
    const { entity: user } = await createUser();

    const result = await fetchOne(db, 'user', user.id);

    expect(result).toBeDefined();
    expect(result?.id).toBe(user.id);
  });

  it('fetches by composite key', async () => {
    const { entity: orgUser } = await createOrganizationUser();

    const result = await fetchOne(db, 'organizationUser', {
      organizationId: orgUser.organizationId,
      userId: orgUser.userId,
    });

    expect(result).toBeDefined();
    expect(result?.organizationId).toBe(orgUser.organizationId);
    expect(result?.userId).toBe(orgUser.userId);
  });

  it('returns null for missing record', async () => {
    const result = await fetchOne(db, 'user', 'nonexistent-id');
    expect(result).toBeNull();
  });
});
