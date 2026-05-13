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

// Batch create. Per scope, computes final positions for the entire batch in
// JS by mirroring the original iterative "fixed-position rows shift DB +
// earlier batch rows up by 1, append rows take currentMax+1" semantics, then
// emits ONE bulk UPDATE to shift existing rows into their final slots. The
// caller writes the new rows at the pre-computed positions on insert.
//
// Cost per scope: 1 SELECT (MAX) + 1 UPDATE (VALUES list). Independent of
// batch size. JS simulation is O(batch²) for the virtual-row shifts, fine
// for any realistic batch.
export const applyOrderedListBatchCreate = async (
  model: string,
  rows: Record<string, unknown>[],
): Promise<void> => {
  const config = configForModel(model);
  if (!config) return;

  for (const row of rows) {
    for (const [, scopeFields] of Object.entries(config)) {
      normalizeInputScope(row, scopeFields);
    }
  }

  for (const [field, scopeFields] of Object.entries(config)) {
    // Group rows by scope, preserving input order within each scope.
    const byScope = new Map<string, { scope: Where; rows: Record<string, unknown>[] }>();
    for (const row of rows) {
      const scope = buildScope(row, scopeFields);
      const key = JSON.stringify(scope);
      let entry = byScope.get(key);
      if (!entry) {
        entry = { scope, rows: [] };
        byScope.set(key, entry);
      }
      entry.rows.push(row);
    }

    for (const { scope, rows: scopedRows } of byScope.values()) {
      await placeBatchInScope(model, scope, field, scopedRows);
    }
  }
};

const placeBatchInScope = async (
  model: string,
  scope: Where,
  field: string,
  batchRows: Record<string, unknown>[],
): Promise<void> => {
  // 1. Read current DB max once.
  const dbMax = (await nextSortOrderRaw(model, scope, field)) - 1;

  // 2. Simulate placement: track each virtual row's running position as
  //    later fixed-position rows bump earlier ones up.
  let currentMax = dbMax;
  const virtuals: { row: Record<string, unknown>; pos: number }[] = [];

  for (const row of batchRows) {
    const slot = row[field] == null
      ? currentMax + 1
      : Math.max(1, Math.min(row[field] as number, currentMax + 1));

    for (const v of virtuals) {
      if (v.pos >= slot) v.pos += 1;
    }
    virtuals.push({ row, pos: slot });
    currentMax += 1;
  }

  // 3. Compute shift per existing row. With batch final positions sorted
  //    ascending, walk original positions in order: each B[i] <= currentPos
  //    bumps the running shift. Monotonic — single pass.
  if (dbMax > 0) {
    const sortedBatchPos = virtuals.map((v) => v.pos).sort((a, b) => a - b);
    const updates: Prisma.Sql[] = [];
    let shift = 0;
    for (let p = 1; p <= dbMax; p++) {
      while (shift < sortedBatchPos.length && sortedBatchPos[shift]! <= p + shift) {
        shift += 1;
      }
      if (shift > 0) updates.push(Prisma.sql`(${p}::int, ${p + shift}::int)`);
    }

    if (updates.length > 0) {
      const t = table(model);
      const f = col(field);
      const scopeSQL = scopeWhere(model, scope, field, true);
      await db.$executeRaw(Prisma.sql`
        UPDATE ${t} SET ${f} = c.new_pos
        FROM (VALUES ${Prisma.join(updates, ', ')}) AS c(old_pos, new_pos)
        WHERE ${scopeSQL} AND ${f} = c.old_pos
      `);
    }
  }

  // 4. Write the computed positions onto the input rows (Prisma will insert).
  for (const v of virtuals) v.row[field] = v.pos;
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

// AFTER-hook for delete / deleteMany. By the time this fires the deleted
// rows are physically gone, so a single reDensifyLive per scope ROW_NUMBERs
// the survivors into [1..N] — one query per scope regardless of how many
// rows were deleted.
export const applyOrderedListHardDelete = async (
  model: string,
  previousRows: Record<string, unknown>[],
): Promise<void> => {
  const config = configForModel(model);
  if (!config) return;

  for (const [field, scopeFields] of Object.entries(config)) {
    const seen = new Set<string>();
    for (const prev of previousRows) {
      const scope = buildScope(prev, scopeFields);
      const key = JSON.stringify(scope);
      if (seen.has(key)) continue;
      seen.add(key);
      await reDensifyLive(model, scope, field);
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

  // Filter to rows actually transitioning state — a bulk
  // `data.deletedAt = null` on a where-clause that matches both already-live
  // and previously-deleted rows must only re-slot the deleted ones.
  // Symmetrically for soft-delete.
  const transitioning = isSoftDeleting
    ? previousRows.filter((p) => p.deletedAt == null)
    : previousRows.filter((p) => p.deletedAt != null);
  if (transitioning.length === 0) return;

  for (const [field, scopeFields] of Object.entries(config)) {
    const grouped = groupIdsByScope(transitioning, scopeFields);

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
