/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses infrastructure:redis
 */

import type { Identifier } from '@inixiative/field-map';
import type { PrismaIncludeOfDown } from '@inixiative/permissions';
import { db } from '@template/db/client';
import {
  entitlementTargetModelOf,
  includeTargetEntitlements,
  isEntitlementTargetAccessor,
} from '@template/db/entitlements/targetEntitlements';
import type { HydratedRecord } from '@template/db/hydrate/types';
import { cacheKey, fetchThroughCache } from '@template/db/redis';
import type { AccessorName } from '@template/db/utils/modelNames';

const DEFAULT_TTL = 60 * 60; // 1 hour

export const fetchCachedRecordWithTargetEntitlements = async <T extends HydratedRecord>(
  accessor: AccessorName,
  identifier: Identifier,
  ttl: number = DEFAULT_TTL,
  downInclude?: PrismaIncludeOfDown,
): Promise<T | null> => {
  const key = cacheKey(accessor, identifier);
  const delegate = db.delegate(accessor);

  const where = typeof identifier === 'string' ? { id: identifier } : identifier;
  const targetInclude = isEntitlementTargetAccessor(accessor)
    ? includeTargetEntitlements(entitlementTargetModelOf(accessor))
    : undefined;
  const include = targetInclude || downInclude ? { ...targetInclude, ...downInclude } : undefined;
  return fetchThroughCache<T | null>(
    key,
    () => delegate.findFirst({ where, include }) as Promise<T | null>,
    ttl,
  );
};
