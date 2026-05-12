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

const scopeSql = (model: string, scope: Where, field: string): { text: string; values: unknown[] } => {
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

  if (hasSoftDelete(model)) {
    parts.push(`"deletedAt" IS NULL`);
  }

  parts.push(`"${field}" > 0`);
  return { text: parts.join(' AND '), values };
};

const shiftRaw = async (
  model: string,
  scope: Where,
  field: string,
  direction: 'increment' | 'decrement',
  predicate: string,
  predicateValues: unknown[],
): Promise<void> => {
  const table = tableName(model);
  const op = direction === 'increment' ? '+' : '-';
  const { text: scopeText, values: scopeValues } = scopeSql(model, scope, field);

  const allValues = [...scopeValues, ...predicateValues];
  const query = `UPDATE ${table} SET "${field}" = "${field}" ${op} 1 WHERE ${scopeText} AND ${predicate}`;

  await db.$executeRawUnsafe(query, ...allValues);
};

// --- Public API ---

const buildScope = (row: Record<string, unknown>, scopeFields: string[]): Where =>
  Object.fromEntries(scopeFields.map((f) => [f, row[f]]));

export const nextSortOrderRaw = async (
  model: string,
  scope: Where,
  field: string,
): Promise<number> => {
  const table = tableName(model);
  const { text: scopeText, values } = scopeSql(model, scope, field);
  const query = `SELECT COALESCE(MAX("${field}"), 0) + 1 AS "next" FROM ${table} WHERE ${scopeText}`;
  const result = await db.$queryRawUnsafe<{ next: number }[]>(query, ...values);
  return Number(result[0]?.next ?? 1);
};

export const minSortOrderRaw = async (
  model: string,
  scope: Where,
  field: string,
): Promise<number> => {
  const table = tableName(model);
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
  parts.push(`"${field}" < 0`);
  const query = `SELECT COALESCE(MIN("${field}"), 0) - 1 AS "next" FROM ${table} WHERE ${parts.join(' AND ')}`;
  const result = await db.$queryRawUnsafe<{ next: number }[]>(query, ...values);
  return Number(result[0]?.next ?? -1);
};

export const insertAtRaw = async (
  model: string,
  scope: Where,
  position: number,
  field: string,
): Promise<number> => {
  const max = await nextSortOrderRaw(model, scope, field);
  const clamped = Math.max(1, Math.min(position, max));
  const { values: scopeValues } = scopeSql(model, scope, field);
  const paramIdx = scopeValues.length + 1;
  await shiftRaw(model, scope, field, 'increment', `"${field}" >= $${paramIdx}`, [clamped]);
  return clamped;
};

export const compactAfterRemove = async (
  model: string,
  scope: Where,
  removedPosition: number,
  field: string,
): Promise<void> => {
  const { values: scopeValues } = scopeSql(model, scope, field);
  const paramIdx = scopeValues.length + 1;
  await shiftRaw(model, scope, field, 'decrement', `"${field}" > $${paramIdx}`, [removedPosition]);
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
  const { text: scopeText, values: scopeValues } = scopeSql(model, scope, field);

  // Park at -1
  await db.$executeRawUnsafe(`UPDATE ${table} SET "${field}" = -1 WHERE "id" = $1`, itemId);

  if (fromOrder > toOrder) {
    const paramIdx = scopeValues.length + 1;
    await shiftRaw(
      model, scope, field, 'increment',
      `"${field}" >= $${paramIdx} AND "${field}" < $${paramIdx + 1}`,
      [toOrder, fromOrder],
    );
  } else {
    const paramIdx = scopeValues.length + 1;
    await shiftRaw(
      model, scope, field, 'decrement',
      `"${field}" > $${paramIdx} AND "${field}" <= $${paramIdx + 1}`,
      [fromOrder, toOrder],
    );
  }

  await db.$executeRawUnsafe(`UPDATE ${table} SET "${field}" = $1 WHERE "id" = $2`, toOrder, itemId);
};

// --- Hook-callable functions ---

export const applyOrderedListDefaults = async (
  model: string,
  row: Record<string, unknown>,
): Promise<void> => {
  const config = orderedListRegistry[model];
  if (!config) return;

  for (const [field, scopeFields] of Object.entries(config)) {
    const scope = buildScope(row, scopeFields);
    if (!scopeFields.every((f) => scope[f] != null)) continue;

    if (row[field] == null) {
      row[field] = await nextSortOrderRaw(model, scope, field);
    } else {
      row[field] = await insertAtRaw(model, scope, row[field] as number, field);
    }
  }
};

export const applyOrderedListSoftDelete = async (
  model: string,
  row: Record<string, unknown>,
  previous: Record<string, unknown>,
): Promise<void> => {
  const config = orderedListRegistry[model];
  if (!config) return;

  const wasLive = previous.deletedAt == null;
  const isSoftDeleting = row.deletedAt != null && row.deletedAt !== undefined;
  if (!wasLive || !isSoftDeleting) return;

  const merged = { ...previous, ...row };
  for (const [field, scopeFields] of Object.entries(config)) {
    const scope = buildScope(merged, scopeFields);
    if (!scopeFields.every((f) => scope[f] != null)) continue;

    const oldPosition = previous[field] as number;
    if (typeof oldPosition !== 'number' || oldPosition <= 0) continue;

    // Move to negative register
    row[field] = await minSortOrderRaw(model, scope, field);
    // Compact the gap left behind
    await compactAfterRemove(model, scope, oldPosition, field);
  }
};

export const applyOrderedListRestore = async (
  model: string,
  row: Record<string, unknown>,
  previous: Record<string, unknown>,
): Promise<void> => {
  const config = orderedListRegistry[model];
  if (!config) return;

  const wasDeleted = previous.deletedAt != null;
  const isRestoring = row.deletedAt === null;
  if (!wasDeleted || !isRestoring) return;

  const merged = { ...previous, ...row };
  for (const [field, scopeFields] of Object.entries(config)) {
    const scope = buildScope(merged, scopeFields);
    if (!scopeFields.every((f) => scope[f] != null)) continue;

    row[field] = await nextSortOrderRaw(model, scope, field);
  }
};

export const applyOrderedListHardDelete = async (
  model: string,
  previous: Record<string, unknown>,
): Promise<void> => {
  const config = orderedListRegistry[model];
  if (!config) return;

  for (const [field, scopeFields] of Object.entries(config)) {
    const scope = buildScope(previous, scopeFields);
    if (!scopeFields.every((f) => scope[f] != null)) continue;

    const oldPosition = previous[field] as number;
    if (typeof oldPosition !== 'number' || oldPosition <= 0) continue;

    await compactAfterRemove(model, scope, oldPosition, field);
  }
};

export const applyOrderedListUpsert = async (
  model: string,
  args: Record<string, unknown>,
  previous: Record<string, unknown> | undefined,
): Promise<void> => {
  const create = args.create as Record<string, unknown> | undefined;
  const update = args.update as Record<string, unknown> | undefined;

  if (!previous && create) {
    await applyOrderedListDefaults(model, create);
  }

  if (previous && update) {
    await applyOrderedListSoftDelete(model, update, previous);
    await applyOrderedListRestore(model, update, previous);
  }
};
