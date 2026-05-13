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

// liveOnly=true:  deletedAt IS NULL AND position > 0  (normal live scope)
// liveOnly=false: scope columns only (no deletedAt / position filter)
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

// deletedAt IS NULL only (no position > 0). Used for reDensifyLive so items
// that were bulk-decremented to ≤0 still get renumbered.
const liveOnlyWhere = (model: string, scope: Where): Prisma.Sql => {
  const parts: Prisma.Sql[] = [];
  for (const [k, v] of Object.entries(scope)) {
    parts.push(v === null ? Prisma.sql`${col(k)} IS NULL` : Prisma.sql`${col(k)} = ${v}`);
  }
  if (hasSoftDelete(model)) parts.push(Prisma.sql`"deletedAt" IS NULL`);
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

// Renumbers all live rows regardless of current position value.
// Used after bulk increment/decrement that may push positions to ≤0.
export const reDensifyLive = async (model: string, scope: Where, field: string): Promise<void> => {
  const t = table(model);
  const f = col(field);
  const where = liveOnlyWhere(model, scope);

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

// Direct reorder helper (call outside Prisma hook context — e.g. from service
// layer or tests). Parks target at 0 (neutral sentinel: excluded from the live
// scope by `position > 0`, doesn't collide with the negative soft-delete space)
// so the shift predicates are clean, then sets the final position.
export const reorderInList = async (
  model: string,
  scope: Where,
  itemId: string,
  fromOrder: number,
  toOrder: number,
  field = 'position',
): Promise<void> => {
  if (fromOrder === toOrder) return;

  const t = table(model);
  const f = col(field);

  await db.$executeRaw(Prisma.sql`UPDATE ${t} SET ${f} = 0 WHERE "id" = ${itemId}`);

  if (fromOrder > toOrder) {
    await shiftUp(model, scope, field, Prisma.sql`${f} >= ${toOrder} AND ${f} < ${fromOrder}`);
  } else {
    await shiftDown(model, scope, field, Prisma.sql`${f} > ${fromOrder} AND ${f} <= ${toOrder}`);
  }

  await db.$executeRaw(Prisma.sql`UPDATE ${t} SET ${f} = ${toOrder} WHERE "id" = ${itemId}`);
};

// --- Hook-callable functions ---

const buildScope = (row: Record<string, unknown>, scopeFields: string[]): Where =>
  Object.fromEntries(scopeFields.map((f) => [f, row[f] ?? null]));

const configForModel = (model: string) => orderedListRegistry[model];

export const applyOrderedListCreate = async (
  model: string,
  row: Record<string, unknown>,
): Promise<void> => {
  const config = configForModel(model);
  if (!config) return;

  for (const [field, scopeFields] of Object.entries(config)) {
    const scope = buildScope(row, scopeFields);
    if (row[field] == null) {
      row[field] = await nextSortOrderRaw(model, scope, field);
    } else {
      row[field] = await insertAtRaw(model, scope, row[field] as number, field);
    }
  }
};

// Batch create: fixed-position rows are canonical — their position is what they
// claim. When a fixed-position row arrives, any DB rows AND any previously-
// assigned batch rows at >= that position are shifted up. Append rows fill the
// next available slot after the current virtual + DB maximum.
type VirtualRow = { row: Record<string, unknown>; pos: number };

export const applyOrderedListBatchCreate = async (
  model: string,
  rows: Record<string, unknown>[],
): Promise<void> => {
  const config = configForModel(model);
  if (!config) return;

  const virtualByScope = new Map<string, VirtualRow[]>();

  for (const row of rows) {
    for (const [field, scopeFields] of Object.entries(config)) {
      const scope = buildScope(row, scopeFields);
      const key = JSON.stringify(scope);
      if (!virtualByScope.has(key)) virtualByScope.set(key, []);
      const vp = virtualByScope.get(key)!;

      if (row[field] == null) {
        // Append: slot after max(DB max, virtual max).
        const dbMax = (await nextSortOrderRaw(model, scope, field)) - 1;
        const virtualMax = vp.length > 0 ? Math.max(...vp.map((v) => v.pos)) : 0;
        const next = Math.max(dbMax, virtualMax) + 1;
        vp.push({ row, pos: next });
        row[field] = next;
      } else {
        // Fixed position: clamp to [1, max+1], shift DB rows AND previous batch rows.
        const dbMax = await nextSortOrderRaw(model, scope, field);
        const clamped = Math.max(1, Math.min(row[field] as number, dbMax));

        await shiftUp(model, scope, field, Prisma.sql`${col(field)} >= ${clamped}`);

        for (const vr of vp) {
          if (vr.pos >= clamped) {
            vr.pos += 1;
            vr.row[field] = vr.pos;
          }
        }
        vp.push({ row, pos: clamped });
        row[field] = clamped;
      }
    }
  }
};

// Called from the BEFORE hook for single `update`.
//
// For soft-delete / restore: sets data[field] and compacts / extends the list.
//
// For explicit position change: shifts ONLY siblings (never the target row) so
// that `query(args)` — which runs on a separate Prisma connection — can UPDATE
// the target without a row-lock deadlock. data[field] is set to the clamped
// destination; Prisma writes it.
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
      if (typeof newPos === 'number' && typeof oldPos === 'number' && oldPos > 0) {
        const max = await nextSortOrderRaw(model, scope, field);
        // max = MAX+1 (the next insert slot). For a move the list doesn't grow,
        // so valid positions are [1, MAX] = [1, max - 1].
        const clamped = Math.max(1, Math.min(newPos, max - 1));

        // Shift siblings to make room. The target row is at oldPos, which is
        // excluded by both predicates (>= clamped AND < oldPos → false when
        // oldPos < oldPos; > oldPos AND <= clamped → false when oldPos > oldPos).
        if (clamped < oldPos) {
          await shiftUp(model, scope, field, Prisma.sql`${col(field)} >= ${clamped} AND ${col(field)} < ${oldPos}`);
        } else if (clamped > oldPos) {
          await shiftDown(model, scope, field, Prisma.sql`${col(field)} > ${oldPos} AND ${col(field)} <= ${clamped}`);
        }

        // Let query(args) write the final position; don't delete so Prisma picks it up.
        data[field] = clamped;
      }
    }
  }
};

export const applyOrderedListHardDelete = async (model: string, previous: Record<string, unknown>): Promise<void> => {
  const config = configForModel(model);
  if (!config) return;

  for (const [field, scopeFields] of Object.entries(config)) {
    const scope = buildScope(previous, scopeFields);
    const oldPos = previous[field] as number;
    if (typeof oldPos === 'number' && oldPos > 0) {
      await compactAfterRemove(model, scope, oldPos, field);
    }
  }
};

// Called from the AFTER hook for updateManyAndReturn when deletedAt changed.
// By this point query(args) has already committed, so the rows' deletedAt is
// set correctly and we can read the current DB state.
//
// Soft-delete: re-densify the live rows, then assign distinct negatives to the
//   rows that were just soft-deleted.
// Restore: assign sequential positive positions (append to end) to restored rows.
export const applyOrderedListBulkDeletedAtChange = async (
  model: string,
  data: Record<string, unknown>,
  previousRows: Record<string, unknown>[],
): Promise<void> => {
  const config = configForModel(model);
  if (!config) return;

  const isSoftDeleting = data.deletedAt != null && data.deletedAt !== undefined;
  const isRestoring = data.deletedAt === null;
  if (!isSoftDeleting && !isRestoring) return;

  for (const [field, scopeFields] of Object.entries(config)) {
    const seen = new Set<string>();

    if (isSoftDeleting) {
      // Re-densify live items first (closes the gaps).
      for (const prev of previousRows) {
        const scope = buildScope(prev, scopeFields);
        const key = JSON.stringify(scope);
        if (seen.has(key)) continue;
        seen.add(key);
        await reDensifyLive(model, scope, field);
      }

      // Assign distinct negatives to the newly soft-deleted rows.
      for (const prev of previousRows) {
        const scope = buildScope(prev, scopeFields);
        const neg = await minSortOrderRaw(model, scope, field);
        await db.$executeRaw(
          Prisma.sql`UPDATE ${table(model)} SET ${col(field)} = ${neg} WHERE "id" = ${prev.id as string}`,
        );
      }
    } else {
      // Restore: append each restored row to the end of the live list.
      const nextByScope = new Map<string, number>();
      for (const prev of previousRows) {
        const scope = buildScope(prev, scopeFields);
        const key = JSON.stringify(scope);
        if (!nextByScope.has(key)) {
          nextByScope.set(key, await nextSortOrderRaw(model, scope, field));
        }
        const pos = nextByScope.get(key)!;
        nextByScope.set(key, pos + 1);
        await db.$executeRaw(
          Prisma.sql`UPDATE ${table(model)} SET ${col(field)} = ${pos} WHERE "id" = ${prev.id as string}`,
        );
      }
    }
  }
};

// Called from the AFTER hook for updateManyAndReturn when position was
// directly manipulated (increment / decrement / set). Re-densifies all live
// rows including those that may have been pushed to ≤0.
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
      const key = JSON.stringify(scope);
      if (seen.has(key)) continue;
      seen.add(key);
      await reDensifyLive(model, scope, field);
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
