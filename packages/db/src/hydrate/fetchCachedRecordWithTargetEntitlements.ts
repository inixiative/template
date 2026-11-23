/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses infrastructure:redis
 */

import type { Identifier } from '@inixiative/field-map';
import {
  type Down,
  type DownPaths,
  type PrismaIncludeOfDown,
  prismaIncludeOfDown,
} from '@inixiative/permissions';
import { db } from '@template/db/client';
import {
  entitlementTargetModelOf,
  includeTargetEntitlements,
  isEntitlementTargetAccessor,
} from '@template/db/entitlements/targetEntitlements';
import { prismaMap } from '@template/db/generated/prismaMap';
import type { HydratedRecord } from '@template/db/hydrate/types';
import { cacheKey, fetchThroughCache } from '@template/db/redis';
import { type AccessorName, toModelName } from '@template/db/utils/modelNames';
import { memoize } from 'lodash-es';

const DEFAULT_TTL = 60 * 60; // 1 hour

const downIncludeOfAccessor = memoize((accessor: AccessorName): PrismaIncludeOfDown | undefined => {
  const fields = prismaMap.models[toModelName(accessor)]?.fields;
  if (!fields) return undefined;
  const down: Down = {};
  for (const [fieldName, field] of Object.entries(fields)) {
    const paths = (field as { annotations?: { permissions?: { down?: readonly string[] } } })
      .annotations?.permissions?.down;
    if (!paths) continue;
    const tree: DownPaths = {};
    for (const path of paths) {
      let node = tree;
      for (const segment of path.split('.')) {
        node = node[segment] ??= {};
      }
    }
    down[fieldName] = tree;
  }
  return prismaIncludeOfDown(down);
});

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
  const resolvedDown = downInclude ?? downIncludeOfAccessor(accessor);
  const include = targetInclude || resolvedDown ? { ...targetInclude, ...resolvedDown } : undefined;
  return fetchThroughCache<T | null>(
    key,
    () => delegate.findFirst({ where, include }) as Promise<T | null>,
    ttl,
  );
};
