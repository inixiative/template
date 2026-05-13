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

// Scope keys must be present on the row with explicit values. Distinguishing
// "absent" from "explicitly null" matters: silently coalescing the two would
// collapse semantically distinct scopes for any model where null is a
// meaningful scope value. Use `normalizeInputScope` at the create boundary
// to materialize undefined-as-null where Prisma's "absent = insert NULL"
// semantics apply.
const buildScope = (row: Record<string, unknown>, scopeFields: string[]): Where => {
  const scope: Where = {};
  for (const f of scopeFields) {
    if (!(f in row)) {
      throw new Error(
        `Ordered list scope field "${f}" missing from row. Set it explicitly (use null to opt out of that scope axis).`,
      );
    }
    const v = row[f];
    if (v === undefined) {
      throw new Error(`Ordered list scope field "${f}" is undefined. Pass null explicitly.`);
    }
    scope[f] = v;
  }
  return scope;
};

// Prisma treats an absent nullable field in args.data as "insert NULL".
// Materialize that on the input row so buildScope can stay strict and the
// scope used for shifts matches the row Prisma is about to write.
const normalizeInputScope = (row: Record<string, unknown>, scopeFields: string[]): void => {
  for (const f of scopeFields) {
    if (row[f] === undefined) row[f] = null;
  }
};

const configForModel = (model: string) => orderedListRegistry[model];

export const applyOrderedListCreate = async (
  model: string,
  row: Record<string, unknown>,
): Promise<void> => {
  const config = configForModel(model);
  if (!config) return;

  for (const [field, scopeFields] of Object.entries(config)) {
    normalizeInputScope(row, scopeFields);
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
      normalizeInputScope(row, scopeFields);
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
    const isSoftDeleting = data.deletedAt != null;
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

// Groups ids by their (field-specific) scope key. JSON.stringify is stable
// because buildScope iterates the registered scopeFields in declaration order.
const groupIdsByScope = (
  rows: Record<string, unknown>[],
  scopeFields: string[],
): Map<string, { scope: Where; ids: string[] }> => {
  const grouped = new Map<string, { scope: Where; ids: string[] }>();
  for (const r of rows) {
    const scope = buildScope(r, scopeFields);
    const key = JSON.stringify(scope);
    let entry = grouped.get(key);
    if (!entry) {
      entry = { scope, ids: [] };
      grouped.set(key, entry);
    }
    entry.ids.push(r.id as string);
  }
  return grouped;
};

// Bulk-assign distinct negatives in a single statement per scope. ROW_NUMBER
// over the deleted-id set, anchored to current MIN(negatives) (0 if none),
// produces a contiguous descending sequence below the lowest existing slot.
const bulkAssignNegatives = async (
  model: string,
  scope: Where,
  field: string,
  ids: string[],
): Promise<void> => {
  if (ids.length === 0) return;
  const t = table(model);
  const f = col(field);
  const scopeSQL = scopeWhere(model, scope, field, false);
  const idsList = Prisma.join(ids.map((id) => Prisma.sql`${id}`), ', ');

  await db.$executeRaw(Prisma.sql`
    WITH base AS (
      SELECT COALESCE(MIN(${f}), 0) AS min_val
      FROM ${t}
      WHERE ${scopeSQL} AND ${f} < 0
    ),
    numbered AS (
      SELECT t."id", (base.min_val - ROW_NUMBER() OVER (ORDER BY t."id" ASC)) AS new_pos
      FROM ${t} t, base
      WHERE t."id" IN (${idsList})
    )
    UPDATE ${t} SET ${f} = numbered.new_pos
    FROM numbered WHERE ${t}."id" = numbered."id"
  `);
};

// Bulk-append restored rows to the end of the live list in one statement per
// scope. Anchored to current MAX(live positives), then ROW_NUMBER assigns
// MAX+1, MAX+2, … in id order.
const bulkAssignAppend = async (
  model: string,
  scope: Where,
  field: string,
  ids: string[],
): Promise<void> => {
  if (ids.length === 0) return;
  const t = table(model);
  const f = col(field);
  const liveScopeSQL = scopeWhere(model, scope, field, true);
  const idsList = Prisma.join(ids.map((id) => Prisma.sql`${id}`), ', ');

  await db.$executeRaw(Prisma.sql`
    WITH base AS (
      SELECT COALESCE(MAX(${f}), 0) AS max_val
      FROM ${t}
      WHERE ${liveScopeSQL}
    ),
    numbered AS (
      SELECT t."id", (base.max_val + ROW_NUMBER() OVER (ORDER BY t."id" ASC)) AS new_pos
      FROM ${t} t, base
      WHERE t."id" IN (${idsList})
    )
    UPDATE ${t} SET ${f} = numbered.new_pos
    FROM numbered WHERE ${t}."id" = numbered."id"
  `);
};

// Called from the AFTER hook for updateManyAndReturn when deletedAt changed.
// By this point query(args) has already committed, so deletedAt is set and
// we can read the current DB state.
//
// Soft-delete: re-densify live rows (close gaps), then bulk-assign distinct
//   negatives to the newly soft-deleted rows in a single statement per scope.
// Restore: bulk-assign sequential positive positions (append to end of each
//   scope's live list).
export const applyOrderedListBulkDeletedAtChange = async (
  model: string,
  data: Record<string, unknown>,
  previousRows: Record<string, unknown>[],
): Promise<void> => {
  const config = configForModel(model);
  if (!config) return;

  const isSoftDeleting = data.deletedAt != null;
  const isRestoring = data.deletedAt === null;
  if (!isSoftDeleting && !isRestoring) return;

  for (const [field, scopeFields] of Object.entries(config)) {
    const grouped = groupIdsByScope(previousRows, scopeFields);

    if (isSoftDeleting) {
      for (const { scope } of grouped.values()) {
        await reDensifyLive(model, scope, field);
      }
      for (const { scope, ids } of grouped.values()) {
        await bulkAssignNegatives(model, scope, field, ids);
      }
    } else {
      for (const { scope, ids } of grouped.values()) {
        await bulkAssignAppend(model, scope, field, ids);
      }
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
