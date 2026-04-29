import type { AnyDelegate } from '@template/db';

// Carde-style dense ordering helpers for a model with an integer `sortOrder`-
// like column scoped to some grouping (e.g. (ownerModel, userId, type) for
// Contact). Reorder via shift-and-renumber: park the moving row at -1, shift
// the affected range, place the row at its target. Insert is just append at
// MAX+1, or insert-at via the same shift trick.
//
// All operations are bounded by the size of the scoped list, not the whole
// table — fine for typical UI-driven reorders.

type Where = Record<string, unknown>;

/** Append: returns the next sortOrder for the scope (MAX+1, or 1 if empty). */
export const nextSortOrder = async <T extends AnyDelegate>(
  delegate: T,
  scope: Where,
  field = 'sortOrder',
): Promise<number> => {
  // biome-ignore lint/suspicious/noExplicitAny: delegate.aggregate is generic across models
  const agg = await (delegate as any).aggregate({
    where: { ...scope, deletedAt: null },
    _max: { [field]: true },
  });
  return ((agg._max as Record<string, number | null>)[field] ?? 0) + 1;
};

/**
 * Move a row from `fromOrder` to `toOrder` within `scope`, shifting the
 * affected siblings. Three writes; wrap in a transaction at the call site
 * if concurrent reorders are a concern.
 */
export const reorderInList = async <T extends AnyDelegate>(
  delegate: T,
  args: {
    scope: Where;
    itemId: string;
    fromOrder: number;
    toOrder: number;
    field?: string;
  },
): Promise<void> => {
  const { scope, itemId, fromOrder, toOrder, field = 'sortOrder' } = args;
  if (fromOrder === toOrder) return;

  // Park at -1 to avoid collision while siblings shift.
  // biome-ignore lint/suspicious/noExplicitAny: delegate.update is generic
  await (delegate as any).update({ where: { id: itemId }, data: { [field]: -1 } });

  if (fromOrder > toOrder) {
    // Moving up — shift items at [toOrder, fromOrder) down by 1.
    // biome-ignore lint/suspicious/noExplicitAny: delegate.updateMany is generic
    await (delegate as any).updateMany({
      where: { ...scope, AND: [{ [field]: { gte: toOrder } }, { [field]: { lt: fromOrder } }] },
      data: { [field]: { increment: 1 } },
    });
  } else {
    // Moving down — shift items at (fromOrder, toOrder] up by 1.
    // biome-ignore lint/suspicious/noExplicitAny: delegate.updateMany is generic
    await (delegate as any).updateMany({
      where: { ...scope, AND: [{ [field]: { gt: fromOrder } }, { [field]: { lte: toOrder } }] },
      data: { [field]: { decrement: 1 } },
    });
  }

  // biome-ignore lint/suspicious/noExplicitAny: delegate.update is generic
  await (delegate as any).update({ where: { id: itemId }, data: { [field]: toOrder } });
};
