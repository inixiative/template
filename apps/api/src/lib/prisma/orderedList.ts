import type { AnyDelegate, Args } from '@template/db';
import { lookupField } from '#/lib/prisma/fieldMetadata';

// Dense ordering helpers for a model with an integer `sortOrder`-like column
// scoped to some grouping. The `scope` parameter defines the unique list
// partition — e.g. `{ brandUuid, type: 'featured' }` means "all items in
// this brand of type 'featured' form one ordered list."
//
// Model-aware: pass a `model` name (PascalCase Prisma model) and the helpers
// auto-detect whether the model has a `deletedAt` column. If it does,
// soft-deleted rows are excluded from all ordering operations automatically.
// No `softDelete` flag to forget.
//
// Uses `updateManyAndReturn` (not `updateMany`) so per-row hooks fire on the
// shifted siblings — see docs/claude/HOOKS.md, `updateMany` is disabled for
// exactly this reason.

type Where = Record<string, unknown>;

type WriteableDelegate<T extends AnyDelegate> = T & {
  update: (args: Args<T, 'update'>) => Promise<unknown>;
  updateManyAndReturn: (args: Args<T, 'updateManyAndReturn'>) => Promise<unknown>;
};

/** True if the model has a `deletedAt` field (DateTime or nullable). */
const modelHasDeletedAt = (model?: string): boolean => {
  if (!model) return false;
  const field = lookupField(model, 'deletedAt');
  return field !== undefined;
};

const scopeWhere = (scope: Where, model?: string): Where =>
  modelHasDeletedAt(model) ? { ...scope, deletedAt: null } : scope;

/** Append: returns the next sortOrder for the scope (MAX+1, or 1 if empty). */
export const nextSortOrder = async <T extends AnyDelegate>(
  delegate: T,
  scope: Where,
  { field = 'sortOrder', model }: { field?: string; model?: string } = {},
): Promise<number> => {
  const top = (await delegate.findFirst({
    where: scopeWhere(scope, model),
    orderBy: { [field]: 'desc' },
    select: { [field]: true },
  } as Args<T, 'findFirst'>)) as Record<string, unknown> | null;
  const current = top?.[field];
  return (typeof current === 'number' ? current : 0) + 1;
};

/**
 * Move a row from `fromOrder` to `toOrder` within `scope`, shifting siblings.
 *
 * `scope` defines the unique list partition — only rows matching the scope
 * (and not soft-deleted, when the model has `deletedAt`) are considered.
 *
 * `pkField` identifies the primary key column used to look up the item
 * (defaults to `'id'`; Zealot uses `'uuid'`).
 *
 * Three writes; wrap in a transaction at the call site if concurrent reorders
 * are a concern.
 */
export const reorderInList = async <T extends AnyDelegate>(
  delegate: T,
  args: {
    scope: Where;
    itemId: string;
    fromOrder: number;
    toOrder: number;
    field?: string;
    pkField?: string;
    model?: string;
  },
): Promise<void> => {
  const {
    scope,
    itemId,
    fromOrder,
    toOrder,
    field = 'sortOrder',
    pkField = 'id',
    model,
  } = args;
  if (fromOrder === toOrder) return;

  const d = delegate as WriteableDelegate<T>;
  const where = scopeWhere(scope, model);

  // Park at -1 to avoid collision while siblings shift.
  await d.update({ where: { [pkField]: itemId }, data: { [field]: -1 } } as Args<T, 'update'>);

  if (fromOrder > toOrder) {
    // Moving up — shift items at [toOrder, fromOrder) down by 1.
    await d.updateManyAndReturn({
      where: { ...where, AND: [{ [field]: { gte: toOrder } }, { [field]: { lt: fromOrder } }] },
      data: { [field]: { increment: 1 } },
    } as Args<T, 'updateManyAndReturn'>);
  } else {
    // Moving down — shift items at (fromOrder, toOrder] up by 1.
    await d.updateManyAndReturn({
      where: { ...where, AND: [{ [field]: { gt: fromOrder } }, { [field]: { lte: toOrder } }] },
      data: { [field]: { decrement: 1 } },
    } as Args<T, 'updateManyAndReturn'>);
  }

  await d.update({ where: { [pkField]: itemId }, data: { [field]: toOrder } } as Args<T, 'update'>);
};

/**
 * Restore a soft-deleted row to the end of its list. Call this when setting
 * `deletedAt` back to null — the row's old sortOrder is stale and may
 * collide with live rows that shifted while it was deleted.
 *
 * Sets the row's sortOrder to MAX+1 within the scope.
 */
export const restoreToEnd = async <T extends AnyDelegate>(
  delegate: T,
  args: {
    scope: Where;
    itemId: string;
    field?: string;
    pkField?: string;
    model?: string;
  },
): Promise<void> => {
  const { scope, itemId, field = 'sortOrder', pkField = 'id', model } = args;
  const order = await nextSortOrder(delegate, scope, { field, model });
  const d = delegate as WriteableDelegate<T>;
  await d.update({ where: { [pkField]: itemId }, data: { [field]: order } } as Args<T, 'update'>);
};
