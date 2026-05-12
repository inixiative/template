import type { AnyDelegate, Args } from '@template/db';
import { lookupField } from '#/lib/prisma/fieldMetadata';
import { orderedListRegistry } from '#/hooks/orderedList/registry';

type Where = Record<string, unknown>;

type WriteableDelegate<T extends AnyDelegate> = T & {
  $name: string;
  update: (args: Args<T, 'update'>) => Promise<unknown>;
  updateManyAndReturn: (args: Args<T, 'updateManyAndReturn'>) => Promise<unknown>;
};

const hasSoftDelete = (delegate: { $name?: string }): boolean => {
  const model = delegate.$name;
  return model ? lookupField(model, 'deletedAt') !== undefined : false;
};

const liveScope = (scope: Where, delegate: { $name?: string }): Where =>
  hasSoftDelete(delegate) ? { ...scope, deletedAt: null } : scope;

const buildScope = (row: Record<string, unknown>, scopeFields: string[]): Where =>
  Object.fromEntries(scopeFields.map((f) => [f, row[f]]));

export const nextSortOrder = async <T extends AnyDelegate>(
  delegate: T,
  scope: Where,
  field = 'sortOrder',
): Promise<number> => {
  const top = (await delegate.findFirst({
    where: liveScope(scope, delegate),
    orderBy: { [field]: 'desc' },
    select: { [field]: true },
  } as Args<T, 'findFirst'>)) as Record<string, unknown> | null;
  const current = top?.[field];
  return (typeof current === 'number' ? current : 0) + 1;
};

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
  const where = liveScope(scope, d);

  await d.update({ where: { id: itemId }, data: { [field]: -1 } } as Args<T, 'update'>);

  if (fromOrder > toOrder) {
    await d.updateManyAndReturn({
      where: { ...where, AND: [{ [field]: { gte: toOrder } }, { [field]: { lt: fromOrder } }] },
      data: { [field]: { increment: 1 } },
    } as Args<T, 'updateManyAndReturn'>);
  } else {
    await d.updateManyAndReturn({
      where: { ...where, AND: [{ [field]: { gt: fromOrder } }, { [field]: { lte: toOrder } }] },
      data: { [field]: { decrement: 1 } },
    } as Args<T, 'updateManyAndReturn'>);
  }

  await d.update({ where: { id: itemId }, data: { [field]: toOrder } } as Args<T, 'update'>);
};

export const restoreToEnd = async <T extends AnyDelegate>(
  delegate: T,
  scope: Where,
  itemId: string,
  field = 'sortOrder',
): Promise<void> => {
  const order = await nextSortOrder(delegate, scope, field);
  const d = delegate as WriteableDelegate<T>;
  await d.update({ where: { id: itemId }, data: { [field]: order } } as Args<T, 'update'>);
};

const insertAt = async <T extends AnyDelegate>(
  delegate: T,
  scope: Where,
  position: number,
  field: string,
): Promise<number> => {
  const max = await nextSortOrder(delegate, scope, field);
  const clamped = Math.max(1, Math.min(position, max));
  const d = delegate as WriteableDelegate<T>;
  const where = liveScope(scope, d);
  await d.updateManyAndReturn({
    where: { ...where, [field]: { gte: clamped } },
    data: { [field]: { increment: 1 } },
  } as Args<T, 'updateManyAndReturn'>);
  return clamped;
};

export const applyOrderedListDefaults = async (
  delegate: { $name?: string } & AnyDelegate,
  row: Record<string, unknown>,
  isUpdate: boolean,
): Promise<void> => {
  if (isUpdate) return;
  const model = delegate.$name;
  if (!model) return;
  const config = orderedListRegistry[model];
  if (!config) return;

  for (const [field, scopeFields] of Object.entries(config)) {
    const scope = buildScope(row, scopeFields);
    if (!scopeFields.every((f) => scope[f] != null)) continue;

    if (row[field] == null) {
      row[field] = await nextSortOrder(delegate, scope, field);
    } else {
      row[field] = await insertAt(delegate, scope, row[field] as number, field);
    }
  }
};

export const applyOrderedListRestore = async (
  delegate: { $name?: string } & AnyDelegate,
  row: Record<string, unknown>,
  previous: Record<string, unknown> | undefined,
  itemId: string,
): Promise<void> => {
  if (!previous) return;
  const wasDeleted = previous.deletedAt != null;
  const isRestoring = row.deletedAt === null;
  if (!wasDeleted || !isRestoring) return;

  const model = delegate.$name;
  if (!model) return;
  const config = orderedListRegistry[model];
  if (!config) return;

  const merged = { ...previous, ...row };
  for (const [field, scopeFields] of Object.entries(config)) {
    const scope = buildScope(merged, scopeFields);
    if (scopeFields.every((f) => scope[f] != null)) {
      row[field] = await nextSortOrder(delegate, scope, field);
    }
  }
};
