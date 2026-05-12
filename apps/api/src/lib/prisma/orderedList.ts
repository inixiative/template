import { db } from '@template/db';
import { lookupField } from '#/lib/prisma/fieldMetadata';
import { orderedListRegistry } from '#/hooks/orderedList/registry';
import { prismaMap } from '@template/db/generated/prismaMap';

export type OrderedListConfig = Record<string, string[]>;
export type OrderedListRegistry = Record<string, OrderedListConfig>;

type Where = Record<string, unknown>;

// --- SQL helpers (bypass mutation lifecycle → no infinite loops) ---

const tableName = (model: string): string => {
  const entry = (prismaMap as Record<string, { dbName: string | null }>)[model];
  return `"${entry?.dbName ?? model}"`;
};

const hasSoftDelete = (model: string): boolean =>
  lookupField(model, 'deletedAt') !== undefined;

const scopeSql = (
  model: string,
  scope: Where,
  field: string,
  opts: { liveOnly?: boolean } = {},
): { text: string; values: unknown[] } => {
  const { liveOnly = true } = opts;
  const parts: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [k, v] of Object.entries(scope)) {
    if (v === null) {
      parts.push(`"${k}" IS NULL`);
    } else {
      parts.push(`"${k}" = $${idx}`);
      values.push(v);
      idx++;
    }
  }

  if (liveOnly) {
    if (hasSoftDelete(model)) parts.push(`"deletedAt" IS NULL`);
    parts.push(`"${field}" > 0`);
  }

  return { text: parts.join(' AND '), values };
};

// --- Raw SQL operations ---

export const nextSortOrderRaw = async (
  model: string,
  scope: Where,
  field: string,
): Promise<number> => {
  const table = tableName(model);
  const { text, values } = scopeSql(model, scope, field);
  const result = await db.$queryRawUnsafe<{ next: number }[]>(
    `SELECT COALESCE(MAX("${field}"), 0) + 1 AS "next" FROM ${table} WHERE ${text}`,
    ...values,
  );
  return Number(result[0]?.next ?? 1);
};

export const minSortOrderRaw = async (
  model: string,
  scope: Where,
  field: string,
): Promise<number> => {
  const table = tableName(model);
  const { text, values } = scopeSql(model, scope, field, { liveOnly: false });
  const result = await db.$queryRawUnsafe<{ next: number }[]>(
    `SELECT COALESCE(MIN("${field}"), 0) - 1 AS "next" FROM ${table} WHERE ${text} AND "${field}" < 0`,
    ...values,
  );
  return Number(result[0]?.next ?? -1);
};

const shiftRaw = async (
  model: string,
  scope: Where,
  field: string,
  direction: 'increment' | 'decrement',
  comparator: string,
  comparatorValues: unknown[],
): Promise<void> => {
  const table = tableName(model);
  const op = direction === 'increment' ? '+' : '-';
  const { text, values } = scopeSql(model, scope, field);
  const offset = values.length + 1;
  const predicate = comparator.replace(/\$NEXT/g, () => `$${offset + comparatorValues.indexOf(comparatorValues[comparatorValues.length - 1])}`);

  // Build parameterized comparator
  let paramComparator = comparator;
  const allValues = [...values];
  let pIdx = values.length + 1;
  for (const v of comparatorValues) {
    paramComparator = paramComparator.replace('$?', `$${pIdx}`);
    allValues.push(v);
    pIdx++;
  }

  await db.$executeRawUnsafe(
    `UPDATE ${table} SET "${field}" = "${field}" ${op} 1 WHERE ${text} AND ${paramComparator}`,
    ...allValues,
  );
};

export const insertAtRaw = async (
  model: string,
  scope: Where,
  position: number,
  field: string,
): Promise<number> => {
  const max = await nextSortOrderRaw(model, scope, field);
  const clamped = Math.max(1, Math.min(position, max));
  await shiftRaw(model, scope, field, 'increment', `"${field}" >= $?`, [clamped]);
  return clamped;
};

export const compactAfterRemove = async (
  model: string,
  scope: Where,
  removedPosition: number,
  field: string,
): Promise<void> => {
  await shiftRaw(model, scope, field, 'decrement', `"${field}" > $?`, [removedPosition]);
};

export const reDensify = async (
  model: string,
  scope: Where,
  field: string,
): Promise<void> => {
  const table = tableName(model);
  const { text, values } = scopeSql(model, scope, field);

  await db.$executeRawUnsafe(
    `WITH numbered AS (
      SELECT "id", ROW_NUMBER() OVER (ORDER BY "${field}" ASC, "id" ASC) AS new_order
      FROM ${table}
      WHERE ${text}
    )
    UPDATE ${table} SET "${field}" = numbered.new_order
    FROM numbered WHERE ${table}."id" = numbered."id"`,
    ...values,
  );
};

export const reorderInList = async (
  model: string,
  scope: Where,
  itemId: string,
  fromOrder: number,
  toOrder: number,
  field = 'sortOrder',
): Promise<void> => {
  if (fromOrder === toOrder) return;

  const table = tableName(model);

  // Park at -1 (outside live range, won't collide with unique index)
  await db.$executeRawUnsafe(`UPDATE ${table} SET "${field}" = -1 WHERE "id" = $1`, itemId);

  if (fromOrder > toOrder) {
    await shiftRaw(model, scope, field, 'increment', `"${field}" >= $? AND "${field}" < $?`, [toOrder, fromOrder]);
  } else {
    await shiftRaw(model, scope, field, 'decrement', `"${field}" > $? AND "${field}" <= $?`, [fromOrder, toOrder]);
  }

  await db.$executeRawUnsafe(`UPDATE ${table} SET "${field}" = $1 WHERE "id" = $2`, toOrder, itemId);
};

// --- Hook-callable functions ---

const buildScope = (row: Record<string, unknown>, scopeFields: string[]): Where =>
  Object.fromEntries(scopeFields.map((f) => [f, row[f]]));

const configForModel = (model: string) => orderedListRegistry[model];

const validScope = (scope: Where, scopeFields: string[]): boolean =>
  scopeFields.every((f) => scope[f] != null);

// Before create: assign MAX+1 if no sortOrder, or shift to make room at specified position
export const applyOrderedListCreate = async (
  model: string,
  row: Record<string, unknown>,
): Promise<void> => {
  const config = configForModel(model);
  if (!config) return;

  for (const [field, scopeFields] of Object.entries(config)) {
    const scope = buildScope(row, scopeFields);
    if (!validScope(scope, scopeFields)) continue;

    if (row[field] == null) {
      row[field] = await nextSortOrderRaw(model, scope, field);
    } else {
      row[field] = await insertAtRaw(model, scope, row[field] as number, field);
    }
  }
};

// Before update: handle soft-delete (negate + compact) and restore (append to end)
export const applyOrderedListUpdate = async (
  model: string,
  data: Record<string, unknown>,
  previous: Record<string, unknown>,
): Promise<void> => {
  const config = configForModel(model);
  if (!config) return;

  const merged = { ...previous, ...data };

  for (const [field, scopeFields] of Object.entries(config)) {
    const scope = buildScope(merged, scopeFields);
    if (!validScope(scope, scopeFields)) continue;

    // Soft delete: live → deleted
    const wasLive = previous.deletedAt == null;
    const isSoftDeleting = data.deletedAt != null && data.deletedAt !== undefined;
    if (wasLive && isSoftDeleting) {
      const oldPos = previous[field] as number;
      if (typeof oldPos === 'number' && oldPos > 0) {
        data[field] = await minSortOrderRaw(model, scope, field);
        await compactAfterRemove(model, scope, oldPos, field);
      }
      continue;
    }

    // Restore: deleted → live
    const wasDeleted = previous.deletedAt != null;
    const isRestoring = data.deletedAt === null;
    if (wasDeleted && isRestoring) {
      data[field] = await nextSortOrderRaw(model, scope, field);
      continue;
    }

    // Direct sortOrder change: shift to make room at target
    if (data[field] !== undefined && data[field] !== previous[field]) {
      const newPos = data[field] as number;
      const oldPos = previous[field] as number;
      if (typeof newPos === 'number' && typeof oldPos === 'number' && newPos > 0 && oldPos > 0) {
        // Use reorder logic: park, shift, place — but via raw SQL
        await reorderInList(model, scope, (previous as Record<string, unknown>).id as string, oldPos, newPos, field);
        // reorderInList already placed the item, so remove from data to avoid double-write
        delete data[field];
      }
    }
  }
};

// After hard delete: compact the gap
export const applyOrderedListHardDelete = async (
  model: string,
  previous: Record<string, unknown>,
): Promise<void> => {
  const config = configForModel(model);
  if (!config) return;

  for (const [field, scopeFields] of Object.entries(config)) {
    const scope = buildScope(previous, scopeFields);
    if (!validScope(scope, scopeFields)) continue;

    const oldPos = previous[field] as number;
    if (typeof oldPos === 'number' && oldPos > 0) {
      await compactAfterRemove(model, scope, oldPos, field);
    }
  }
};

// After bulk sortOrder manipulation: re-densify to fix gaps/collisions/non-positive
export const applyOrderedListReDensify = async (
  model: string,
  data: Record<string, unknown>,
  previousRows: Record<string, unknown>[],
): Promise<void> => {
  const config = configForModel(model);
  if (!config) return;

  for (const [field, scopeFields] of Object.entries(config)) {
    // Only re-densify if this update touched sortOrder
    if (data[field] === undefined) continue;

    // Collect all unique scopes from affected rows
    const seen = new Set<string>();
    for (const prev of previousRows) {
      const scope = buildScope({ ...prev, ...data }, scopeFields);
      if (!validScope(scope, scopeFields)) continue;
      const key = JSON.stringify(scope);
      if (seen.has(key)) continue;
      seen.add(key);
      await reDensify(model, scope, field);
    }
  }
};

// Before upsert: route to create or update path
export const applyOrderedListUpsert = async (
  model: string,
  args: Record<string, unknown>,
  previous: Record<string, unknown> | undefined,
): Promise<void> => {
  const create = args.create as Record<string, unknown> | undefined;
  const update = args.update as Record<string, unknown> | undefined;

  if (!previous && create) {
    await applyOrderedListCreate(model, create);
  }

  if (previous && update) {
    await applyOrderedListUpdate(model, update, previous);
  }
};
