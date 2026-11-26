/**
 * @atlas
 * @kind utils
 * @partOf feature:auditLogs, feature:webhooks, primitive:caching
 */
import {
  DbAction,
  type HookOptions,
  isNoOpUpdate,
  type ManyAction,
  NOOP_FIELDS,
  type SingleAction,
} from '@template/db';
import { castArray, isPlainObject, keyBy } from 'lodash-es';

export type HookRow = Record<string, unknown>;
type HookEntityRow = HookRow & { id?: string; deletedAt?: Date | null };

export const ALL_MUTATION_ACTIONS: DbAction[] = [
  DbAction.create,
  DbAction.update,
  DbAction.delete,
  DbAction.upsert,
  DbAction.createManyAndReturn,
  DbAction.updateManyAndReturn,
  DbAction.deleteMany,
];

export const isManyAction = (action: DbAction): action is ManyAction =>
  action === DbAction.createManyAndReturn ||
  action === DbAction.updateManyAndReturn ||
  action === DbAction.deleteMany;

const isUpdateAction = (action: DbAction): boolean =>
  action === DbAction.update || action === DbAction.updateManyAndReturn;

// Pairs each post-write row with its matching pre-write row across single and bulk actions.
export const changedPairs = (
  options: HookOptions,
  { skipNoOp = false }: { skipNoOp?: boolean } = {},
): { result?: HookEntityRow; previous?: HookEntityRow }[] => {
  let pairs: { result?: HookEntityRow; previous?: HookEntityRow }[];

  if (isManyAction(options.action)) {
    const { result, previous } = options as HookOptions & { action: ManyAction };
    const results = (result ?? []) as HookEntityRow[];
    const previousList = (previous ?? []) as HookEntityRow[];
    const previousById = keyBy(previousList, 'id');
    pairs =
      results.length > 0
        ? results.map((row) => ({
            result: row,
            previous: row.id ? previousById[row.id] : undefined,
          }))
        : previousList.map((row) => ({ previous: row }));
  } else {
    const { result, previous } = options as HookOptions & { action: SingleAction };
    const row = result as HookEntityRow | undefined;
    const prev = previous as HookEntityRow | undefined;
    pairs = row || prev ? [{ result: row, previous: prev }] : [];
  }

  if (skipNoOp && isUpdateAction(options.action)) {
    return pairs.filter(
      ({ result, previous }) =>
        !result || !isNoOpUpdate(options.model, result, previous, NOOP_FIELDS),
    );
  }
  return pairs;
};

// The rows a write sets, coalesced: `data` for create and update (single or bulk), both arms of an upsert.
export const rowsBeingWritten = ({ action, args }: HookOptions): HookRow[] => {
  const { data, create, update } = (args ?? {}) as {
    data?: unknown;
    create?: unknown;
    update?: unknown;
  };
  const written = action === DbAction.upsert ? [create, update] : castArray(data);
  return written.filter((row): row is HookRow => isPlainObject(row));
};
