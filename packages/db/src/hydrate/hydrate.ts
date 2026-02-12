import type { Db } from '@template/db/clientTypes';
import { cacheKey } from '@template/db/redis';
import type { AccessorName } from '@template/db/utils/modelNames';
import { getAccessorRelations, type Identifier } from '@template/db/utils/runtimeDataModel';
import { fetchOne } from '@template/db/hydrate/fetchOne';
import type { HydratedRecord } from '@template/db/hydrate/types';

type PendingMap = Map<string, Promise<HydratedRecord | null>>;

/**
 * Resolve FK mapping to actual values from the record.
 * FK mapping is { targetField: sourceField } - we read sourceField from record
 * and build { targetField: value } for querying.
 */
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
): Promise<T & HydratedRecord> => {
  const relations = getAccessorRelations(accessor);
  const result: HydratedRecord = { ...record };

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

    const hydrated = await hydrate(db, rel.targetAccessor, related, pending);
    return { name: rel.relationName, value: hydrated };
  });

  const results = await Promise.all(relationBatch);
  for (const { name, value } of results) {
    if (value) result[name] = value;
  }

  return result as T & HydratedRecord;
};
