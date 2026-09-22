/**
 * @atlas
 * @kind service
 * @partOf feature:featureFlag
 * @uses infrastructure:prisma, primitive:caching, feature:segment
 */
import { cache, cacheKey, db } from '@template/db';
import type { CustomerRef, FeatureFlag, FeatureFlagVariant, Segment } from '@template/db/generated/client/client';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { groupBy, uniq } from 'lodash-es';
import {
  customerRefSegmentMembersKey,
  featureFlagVariantsKey,
  ownerFeatureFlagsKey,
} from '#/modules/featureFlag/lib/featureFlagCacheKeys';
import { featureFlagOwnerIdOf } from '#/modules/featureFlag/lib/featureFlagOwner';
import { type FlagValue, zeroFor } from '#/modules/featureFlag/lib/zeroFor';
import { VALUE_COLUMNS } from '#/modules/featureFlag/validations/validateFeatureFlagVariantRow';
import { type Provider, providerOf } from '#/modules/segment/lib/segmentOwner';

const FLAG_TTL = 60 * 10;

export type FlagStep = 'disabled' | 'gate' | 'rule' | 'default' | 'zero';

export type ResolvedFlag = {
  flag: FeatureFlag;
  value: FlagValue;
  step: FlagStep;
  variant: FeatureFlagVariant | null;
};

export type ResolvedRef = { customerRef: CustomerRef; provider: Provider; flags: Record<string, ResolvedFlag> };

export type ResolvedFlags = { refs: ResolvedRef[] };

export const hopKey = ({ ownerModel, ownerId }: Provider): string => `${ownerModel}:${ownerId}`;

const ownerFlags = (provider: Provider): Promise<FeatureFlag[]> =>
  cache(
    ownerFeatureFlagsKey(provider.ownerModel, provider.ownerId),
    () =>
      db.featureFlag.findMany({
        where: {
          ownerModel: provider.ownerModel,
          ...(provider.ownerModel === 'platform'
            ? {}
            : { [`${provider.ownerModel.toLowerCase()}Id`]: provider.ownerId }),
          deletedAt: null,
        },
      }),
    FLAG_TTL,
  );

const flagVariants = (flagId: string): Promise<FeatureFlagVariant[]> =>
  cache(
    featureFlagVariantsKey(flagId),
    () =>
      db.featureFlagVariant.findMany({
        where: { featureFlagId: flagId, deletedAt: null },
        orderBy: { position: 'asc' },
      }),
    FLAG_TTL,
  );

const memberSegmentIds = (customerRefId: string): Promise<string[]> =>
  cache(
    customerRefSegmentMembersKey(customerRefId),
    async () => (await db.segmentMember.findMany({ where: { customerRefId } })).map((member) => member.segmentId),
    FLAG_TTL,
  );

const liveSegment = (segmentId: string): Promise<Segment | null> =>
  cache(cacheKey('segment', segmentId), () => db.segment.findUnique({ where: { id: segmentId } }), FLAG_TTL);

const liveSegmentIds = async (segmentIds: string[]): Promise<Set<string>> => {
  const rows = await Promise.all(uniq(segmentIds).map(liveSegment));
  return new Set(rows.filter((row): row is Segment => !!row && !row.deletedAt).map((row) => row.id));
};

const variantValue = (flag: FeatureFlag, variant: FeatureFlagVariant): FlagValue =>
  variant[VALUE_COLUMNS[flag.valueType]] as FlagValue;

export const foldFlag = (
  flag: FeatureFlag,
  variants: FeatureFlagVariant[],
  memberOf: Set<string>,
  live: Set<string>,
): ResolvedFlag => {
  const matches = (segmentId: string | null): boolean => !!segmentId && live.has(segmentId) && memberOf.has(segmentId);
  const defaultVariant = variants.find((variant) => variant.isDefault) ?? null;
  const fallback = (): ResolvedFlag =>
    defaultVariant
      ? { flag, value: variantValue(flag, defaultVariant), step: 'default', variant: defaultVariant }
      : { flag, value: zeroFor(flag.valueType), step: 'zero', variant: null };

  if (!flag.enabled) return { flag, value: zeroFor(flag.valueType), step: 'disabled', variant: null };
  if (flag.segmentId && !matches(flag.segmentId)) return { ...fallback(), step: 'gate' };
  const rule = variants.find((variant) => !variant.isDefault && matches(variant.segmentId));
  if (rule) return { flag, value: variantValue(flag, rule), step: 'rule', variant: rule };
  return fallback();
};

export const resolveFlags = async (refs: CustomerRef[]): Promise<ResolvedFlags> => {
  const byHop = groupBy(refs, (ref) => hopKey(providerOf(ref)));
  const resolved: ResolvedRef[] = [];
  for (const hopRefs of Object.values(byHop)) {
    const provider = providerOf(hopRefs[0]!);
    const flags = await ownerFlags(provider);
    const variantsByFlag = new Map(
      await Promise.all(flags.map(async (flag) => [flag.id, await flagVariants(flag.id)] as const)),
    );
    const live = await liveSegmentIds([
      ...flags.flatMap((flag) => (flag.segmentId ? [flag.segmentId] : [])),
      ...[...variantsByFlag.values()].flat().flatMap((variant) => (variant.segmentId ? [variant.segmentId] : [])),
    ]);
    for (const customerRef of hopRefs) {
      const memberOf = new Set(await memberSegmentIds(customerRef.id));
      const addressed = flags.filter((flag) => flag.subjectModel === customerRef.customerModel);
      const entries = addressed.map((flag) => [
        flag.slug,
        foldFlag(flag, variantsByFlag.get(flag.id)!, memberOf, live),
      ]);
      resolved.push({ customerRef, provider, flags: Object.fromEntries(entries) });
    }
  }
  return { refs: resolved };
};

export const flagOwnerOf = (flag: FeatureFlag): Provider => ({
  ownerModel: flag.ownerModel as ProviderModel,
  ownerId: featureFlagOwnerIdOf(flag),
});
