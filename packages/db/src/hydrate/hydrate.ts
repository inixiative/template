/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses infrastructure:redis
 */
import type { Db } from '@template/db/clientTypes';
import { fetchOne } from '@template/db/hydrate/fetchOne';
import type { HydratedRecord } from '@template/db/hydrate/types';
import { cacheKey } from '@template/db/redis';
import type { AccessorName } from '@template/db/utils/modelNames';
import { getAccessorRelations, type Identifier, isPermissionEdge } from '@template/db/utils/prismaMapRelations';

type PendingMap = Map<string, Promise<HydratedRecord | null>>;

const recordKey = (accessor: AccessorName, record: HydratedRecord): string => cacheKey(accessor, record.id as string);

const resolveIdentifier = (record: HydratedRecord, fk: Identifier): Identifier | null => {
  if (typeof fk === 'string') {
    // Simple: source field name equals target field name
    const value = record[fk] as string | undefined;
    return value ?? null;
  }

  // Composite: { targetField: sourceField }
  const resolved: Record<string, string> = {};
  for (const [targetField, sourceField] of Object.entries(fk)) {
    const value = record[sourceField] as string | undefined;
    if (!value) return null;
    resolved[targetField] = value;
  }
  return resolved;
};

export const hydrate = async <T extends HydratedRecord>(
  db: Db,
  accessor: AccessorName,
  record: T,
  pending: PendingMap = new Map(),
  hydrating: Set<string> = new Set(),
): Promise<T & HydratedRecord> => {
  const relations = getAccessorRelations(accessor).filter(isPermissionEdge);
  const result: HydratedRecord = { ...record };
  const path = new Set([...hydrating, recordKey(accessor, record)]);

  const relationBatch = relations.map(async (rel) => {
    if (!rel.foreignKey) return { name: rel.relationName, value: null };

    const identifier = resolveIdentifier(record, rel.foreignKey);
    if (!identifier) return { name: rel.relationName, value: null };

    const key = cacheKey(rel.targetAccessor, identifier);
    if (!pending.has(key)) {
      pending.set(key, fetchOne<HydratedRecord>(db, rel.targetAccessor, identifier));
    }

    const related = await pending.get(key)!;
    if (!related) return { name: rel.relationName, value: null };
    if (path.has(recordKey(rel.targetAccessor, related))) {
      throw new Error(
        `Relation cycle while hydrating ${accessor}.${rel.relationName}: ${[...path, recordKey(rel.targetAccessor, related)].join(' -> ')}. Tag one edge /// @permissions(hydrate: false)`,
      );
    }

    const hydrated = await hydrate(db, rel.targetAccessor, related, pending, path);
    return { name: rel.relationName, value: hydrated };
  });

  const results = await Promise.all(relationBatch);
  for (const { name, value } of results) {
    if (value) result[name] = value;
  }

  return result as T & HydratedRecord;
};
