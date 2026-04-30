import { type AnyDelegate, type Args } from '@template/db';

// Carde-style dense ordering helpers for a model with an integer `sortOrder`-
// like column scoped to some grouping (e.g. (ownerModel, userId, type) for
// Contact). Reorder via shift-and-renumber: park the moving row at -1, shift
// the affected range, place the row at its target. Insert is just append at
// MAX+1, or insert-at via the same shift trick.
//
// Uses `updateManyAndReturn` (not `updateMany`) so per-row hooks fire on the
// shifted siblings — see docs/claude/HOOKS.md, `updateMany` is disabled for
// exactly this reason.

type Where = Record<string, unknown>;

// AnyDelegate only carries read ops; reorder also needs update +
// updateManyAndReturn. Mirrors paginate.ts's pattern of leaning on the
// inferred Prisma delegate type, with a small structural intersection for
// the writes we use here.
type WriteableDelegate<T extends AnyDelegate> = T & {
  update: (args: Args<T, 'update'>) => Promise<unknown>;
  updateManyAndReturn: (args: Args<T, 'updateManyAndReturn'>) => Promise<unknown>;
};

/** Append: returns the next sortOrder for the scope (MAX+1, or 1 if empty). */
export const nextSortOrder = async <T extends AnyDelegate>(
  delegate: T,
  scope: Where,
  field = 'sortOrder',
): Promise<number> => {
  const top = (await delegate.findFirst({
    where: { ...scope, deletedAt: null },
    orderBy: { [field]: 'desc' },
    select: { [field]: true },
  } as Args<T, 'findFirst'>)) as Record<string, unknown> | null;
  const current = top?.[field];
  return (typeof current === 'number' ? current : 0) + 1;
};

/**
 * Move a row from `fromOrder` to `toOrder` within `scope`, shifting siblings.
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
  },
): Promise<void> => {
  const { scope, itemId, fromOrder, toOrder, field = 'sortOrder' } = args;
  if (fromOrder === toOrder) return;

  const d = delegate as WriteableDelegate<T>;

  // Park at -1 to avoid collision while siblings shift.
  await d.update({ where: { id: itemId }, data: { [field]: -1 } } as Args<T, 'update'>);

  if (fromOrder > toOrder) {
    // Moving up — shift items at [toOrder, fromOrder) down by 1.
    await d.updateManyAndReturn({
      where: { ...scope, AND: [{ [field]: { gte: toOrder } }, { [field]: { lt: fromOrder } }] },
      data: { [field]: { increment: 1 } },
    } as Args<T, 'updateManyAndReturn'>);
  } else {
    // Moving down — shift items at (fromOrder, toOrder] up by 1.
    await d.updateManyAndReturn({
      where: { ...scope, AND: [{ [field]: { gt: fromOrder } }, { [field]: { lte: toOrder } }] },
      data: { [field]: { decrement: 1 } },
    } as Args<T, 'updateManyAndReturn'>);
  }

  await d.update({ where: { id: itemId }, data: { [field]: toOrder } } as Args<T, 'update'>);
};
