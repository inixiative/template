import type { AnyDelegate, Args } from '@template/db';

// Dense ordering helpers for a model with an integer `sortOrder`-like column
// scoped to some grouping. The `scope` parameter defines the unique list
// partition — e.g. `{ brandUuid, type: 'featured' }` means "all items in
// this brand of type 'featured' form one ordered list."
//
// Both helpers filter `deletedAt: null` by default so soft-deleted rows don't
// interfere with ordering. Pass `softDelete: false` to opt out (e.g. for
// models without a `deletedAt` column).
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

const withSoftDelete = (where: Where, softDelete: boolean): Where =>
  softDelete ? { ...where, deletedAt: null } : where;

/** Append: returns the next sortOrder for the scope (MAX+1, or 1 if empty). */
export const nextSortOrder = async <T extends AnyDelegate>(
  delegate: T,
  scope: Where,
  field = 'sortOrder',
  { softDelete = true }: { softDelete?: boolean } = {},
): Promise<number> => {
  const top = (await delegate.findFirst({
    where: withSoftDelete(scope, softDelete),
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
 * are considered part of this ordered list.
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
    softDelete?: boolean;
  },
): Promise<void> => {
  const {
    scope,
    itemId,
    fromOrder,
    toOrder,
    field = 'sortOrder',
    pkField = 'id',
    softDelete = true,
  } = args;
  if (fromOrder === toOrder) return;

  const d = delegate as WriteableDelegate<T>;
  const scopeWhere = withSoftDelete(scope, softDelete);

  // Park at -1 to avoid collision while siblings shift.
  await d.update({ where: { [pkField]: itemId }, data: { [field]: -1 } } as Args<T, 'update'>);

  if (fromOrder > toOrder) {
    // Moving up — shift items at [toOrder, fromOrder) down by 1.
    await d.updateManyAndReturn({
      where: { ...scopeWhere, AND: [{ [field]: { gte: toOrder } }, { [field]: { lt: fromOrder } }] },
      data: { [field]: { increment: 1 } },
    } as Args<T, 'updateManyAndReturn'>);
  } else {
    // Moving down — shift items at (fromOrder, toOrder] up by 1.
    await d.updateManyAndReturn({
      where: { ...scopeWhere, AND: [{ [field]: { gt: fromOrder } }, { [field]: { lte: toOrder } }] },
      data: { [field]: { decrement: 1 } },
    } as Args<T, 'updateManyAndReturn'>);
  }

  await d.update({ where: { [pkField]: itemId }, data: { [field]: toOrder } } as Args<T, 'update'>);
};
