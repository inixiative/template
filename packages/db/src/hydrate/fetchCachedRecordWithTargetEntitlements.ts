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
import { cacheKey, fetchManyThroughCache, fetchThroughCache } from '@template/db/redis';
import { type AccessorName, toModelName } from '@template/db/utils/modelNames';
import { memoize } from 'lodash-es';

const DEFAULT_TTL = 60 * 60; // 1 hour

// why: cache lookups and makeHydrator share the same Redis key, so cached rows must include @permissions(down) lists.
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

const hydrateIncludeOfAccessor = (accessor: AccessorName) => {
  const targetInclude = isEntitlementTargetAccessor(accessor)
    ? includeTargetEntitlements(entitlementTargetModelOf(accessor))
    : undefined;
  const downInclude = downIncludeOfAccessor(accessor);
  return targetInclude || downInclude ? { ...targetInclude, ...downInclude } : undefined;
};

const whereOfIdentifier = (identifier: Identifier): Record<string, unknown> =>
  typeof identifier === 'string' ? { id: identifier } : identifier;

const whereOfIdentifiers = (
  wheres: Record<string, unknown>[],
  columns: readonly string[],
): Record<string, unknown> => {
  if (columns.length === 1) {
    const column = columns[0]!;
    return { [column]: { in: wheres.map((where) => where[column]) } };
  }
  return { OR: wheres };
};

const cacheKeyOfLoadedRow = (
  accessor: AccessorName,
  row: HydratedRecord,
  columns: readonly string[],
): string =>
  cacheKey(
    accessor,
    Object.fromEntries(columns.map((column) => [column, String(row[column])])) as Identifier,
  );

export const fetchCachedRecordWithTargetEntitlements = async <T extends HydratedRecord>(
  accessor: AccessorName,
  identifier: Identifier,
  ttl: number = DEFAULT_TTL,
): Promise<T | null> => {
  const key = cacheKey(accessor, identifier);
  const delegate = db.delegate(accessor);
  const where = whereOfIdentifier(identifier);
  const include = hydrateIncludeOfAccessor(accessor);
  return fetchThroughCache<T | null>(
    key,
    () => delegate.findFirst({ where, include }) as Promise<T | null>,
    ttl,
  );
};

export const fetchCachedRecordsWithTargetEntitlements = async <T extends HydratedRecord>(
  accessor: AccessorName,
  identifiers: readonly Identifier[],
  ttl: number = DEFAULT_TTL,
): Promise<(T | null)[]> => {
  if (identifiers.length === 0) return [];
  const keys = identifiers.map((identifier) => cacheKey(accessor, identifier));
  const whereByKey = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < identifiers.length; i++) {
    whereByKey.set(keys[i]!, whereOfIdentifier(identifiers[i]!));
  }

  const delegate = db.delegate(accessor);
  const include = hydrateIncludeOfAccessor(accessor);

  return fetchManyThroughCache<T>(
    keys,
    async (missedKeys) => {
      const groups = new Map<string, { columns: string[]; wheres: Record<string, unknown>[] }>();
      for (const key of missedKeys) {
        const where = whereByKey.get(key)!;
        const columns = Object.keys(where).sort();
        const signature = columns.join('\0');
        let group = groups.get(signature);
        if (!group) {
          group = { columns, wheres: [] };
          groups.set(signature, group);
        }
        group.wheres.push(where);
      }

      const loadedByKey = new Map<string, T>();
      await Promise.all(
        [...groups.values()].map(async ({ columns, wheres }) => {
          const loadedRows = (await delegate.findMany({
            where: whereOfIdentifiers(wheres, columns),
            include,
          })) as T[];
          for (const loadedRow of loadedRows) {
            const rowKey = cacheKeyOfLoadedRow(accessor, loadedRow, columns);
            if (!loadedByKey.has(rowKey)) loadedByKey.set(rowKey, loadedRow);
          }
        }),
      );
      return loadedByKey;
    },
    ttl,
  );
};
