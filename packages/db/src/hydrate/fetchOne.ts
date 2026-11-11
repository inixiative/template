/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses infrastructure:redis
 */
import { db } from '@template/db/client';
import {
  includeTargetEntitlements,
  isEntitlementTargetAccessor,
} from '@template/db/entitlements/targetEntitlements';
import type { HydratedRecord } from '@template/db/hydrate/types';
import { cache, cacheKey } from '@template/db/redis';
import type { AccessorName } from '@template/db/utils/modelNames';
import type { Identifier } from '@template/db/utils/prismaMapRelations';

const DEFAULT_TTL = 60 * 60; // 1 hour

export const fetchOne = async <T extends HydratedRecord>(
  accessor: AccessorName,
  identifier: Identifier,
  ttl: number = DEFAULT_TTL,
): Promise<T | null> => {
  const key = cacheKey(accessor, identifier);
  const delegate = db.delegate(accessor);

  const where = typeof identifier === 'string' ? { id: identifier } : identifier;
  const include = isEntitlementTargetAccessor(accessor) ? includeTargetEntitlements : undefined;
  return cache<T | null>(
    key,
    () => delegate.findFirst({ where, include }) as Promise<T | null>,
    ttl,
  );
};
