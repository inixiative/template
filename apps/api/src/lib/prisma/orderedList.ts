import { db, Prisma } from '@template/db';
import { lookupField } from '#/lib/prisma/fieldMetadata';
import { orderedListRegistry } from '#/hooks/orderedList/registry';
import { prismaMap } from '@template/db/generated/prismaMap';

export type OrderedListConfig = Record<string, string[]>;
export type OrderedListRegistry = Record<string, OrderedListConfig>;

type Where = Record<string, unknown>;

// --- SQL building via Prisma.sql (parameterized, no string interpolation for values) ---

const table = (model: string) => {
  const entry = (prismaMap as Record<string, { dbName: string | null }>)[model];
  return Prisma.raw(`"${entry?.dbName ?? model}"`);
};

const col = (name: string) => Prisma.raw(`"${name}"`);

const hasSoftDelete = (model: string): boolean =>
  lookupField(model, 'deletedAt') !== undefined;

const scopeWhere = (model: string, scope: Where, field: string, liveOnly = true): Prisma.Sql => {
  const parts: Prisma.Sql[] = [];

  for (const [k, v] of Object.entries(scope)) {
    parts.push(v === null ? Prisma.sql`${col(k)} IS NULL` : Prisma.sql`${col(k)} = ${v}`);
  }

  if (liveOnly) {
    if (hasSoftDelete(model)) parts.push(Prisma.sql`"deletedAt" IS NULL`);
    parts.push(Prisma.sql`${col(field)} > 0`);
  }

  return Prisma.join(parts, ' AND ');
};

// --- Raw SQL operations (bypass mutation lifecycle) ---

export const nextSortOrderRaw = async (model: string, scope: Where, field: string): Promise<number> => {
  const where = scopeWhere(model, scope, field);
  const result = await db.$queryRaw<{ next: bigint }[]>(
    Prisma.sql`SELECT COALESCE(MAX(${col(field)}), 0) + 1 AS "next" FROM ${table(model)} WHERE ${where}`,
  );
  return Number(result[0]?.next ?? 1);
};

export const minSortOrderRaw = async (model: string, scope: Where, field: string): Promise<number> => {
  const where = scopeWhere(model, scope, field, false);
  const result = await db.$queryRaw<{ next: bigint }[]>(
    Prisma.sql`SELECT COALESCE(MIN(${col(field)}), 0) - 1 AS "next" FROM ${table(model)} WHERE ${where} AND ${col(field)} < 0`,
  );
  return Number(result[0]?.next ?? -1);
};

const shiftUp = async (model: string, scope: Where, field: string, predicate: Prisma.Sql): Promise<void> => {
  const where = scopeWhere(model, scope, field);
  await db.$executeRaw(
    Prisma.sql`UPDATE ${table(model)} SET ${col(field)} = ${col(field)} + 1 WHERE ${where} AND ${predicate}`,
  );
};

const shiftDown = async (model: string, scope: Where, field: string, predicate: Prisma.Sql): Promise<void> => {
  const where = scopeWhere(model, scope, field);
  await db.$executeRaw(
    Prisma.sql`UPDATE ${table(model)} SET ${col(field)} = ${col(field)} - 1 WHERE ${where} AND ${predicate}`,
  );
};

export const insertAtRaw = async (model: string, scope: Where, position: number, field: string): Promise<number> => {
  const max = await nextSortOrderRaw(model, scope, field);
  const clamped = Math.max(1, Math.min(position, max));
  await shiftUp(model, scope, field, Prisma.sql`${col(field)} >= ${clamped}`);
  return clamped;
};

export const compactAfterRemove = async (model: string, scope: Where, removedPosition: number, field: string): Promise<void> => {
  await shiftDown(model, scope, field, Prisma.sql`${col(field)} > ${removedPosition}`);
};

export const reDensify = async (model: string, scope: Where, field: string): Promise<void> => {
  const t = table(model);
  const f = col(field);
  const where = scopeWhere(model, scope, field);

  await db.$executeRaw(Prisma.sql`
    WITH numbered AS (
      SELECT "id", ROW_NUMBER() OVER (ORDER BY ${f} ASC, "id" ASC) AS new_order
      FROM ${t}
      WHERE ${where}
    )
    UPDATE ${t} SET ${f} = numbered.new_order
    FROM numbered WHERE ${t}."id" = numbered."id"
  `);
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

  const t = table(model);
  const f = col(field);

  await db.$executeRaw(Prisma.sql`UPDATE ${t} SET ${f} = -1 WHERE "id" = ${itemId}`);

  if (fromOrder > toOrder) {
    await shiftUp(model, scope, field, Prisma.sql`${f} >= ${toOrder} AND ${f} < ${fromOrder}`);
  } else {
    await shiftDown(model, scope, field, Prisma.sql`${f} > ${fromOrder} AND ${f} <= ${toOrder}`);
  }

  await db.$executeRaw(Prisma.sql`UPDATE ${t} SET ${f} = ${toOrder} WHERE "id" = ${itemId}`);
};

// --- Hook-callable functions ---

const buildScope = (row: Record<string, unknown>, scopeFields: string[]): Where =>
  Object.fromEntries(scopeFields.map((f) => [f, row[f]]));

const configForModel = (model: string) => orderedListRegistry[model];

const validScope = (scope: Where, scopeFields: string[]): boolean =>
  scopeFields.every((f) => scope[f] != null);

export const applyOrderedListCreate = async (model: string, row: Record<string, unknown>): Promise<void> => {
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

    const wasDeleted = previous.deletedAt != null;
    const isRestoring = data.deletedAt === null;
    if (wasDeleted && isRestoring) {
      data[field] = await nextSortOrderRaw(model, scope, field);
      continue;
    }

    if (data[field] !== undefined && data[field] !== previous[field]) {
      const newPos = data[field] as number;
      const oldPos = previous[field] as number;
      if (typeof newPos === 'number' && typeof oldPos === 'number' && newPos > 0 && oldPos > 0) {
        await reorderInList(model, scope, (previous as Record<string, unknown>).id as string, oldPos, newPos, field);
        delete data[field];
      }
    }
  }
};

export const applyOrderedListHardDelete = async (model: string, previous: Record<string, unknown>): Promise<void> => {
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

export const applyOrderedListReDensify = async (
  model: string,
  data: Record<string, unknown>,
  previousRows: Record<string, unknown>[],
): Promise<void> => {
  const config = configForModel(model);
  if (!config) return;

  for (const [field, scopeFields] of Object.entries(config)) {
    if (data[field] === undefined) continue;

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
