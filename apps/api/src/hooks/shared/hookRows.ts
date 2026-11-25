/**
 * @atlas
 * @kind utils
 * @partOf feature:auditLogs, feature:webhooks
 */
import { DbAction, type HookOptions, type ManyAction, type SingleAction } from '@template/db';
import { castArray, isPlainObject, keyBy } from 'lodash-es';

export type HookRow = Record<string, unknown>;
export type HookEntityRow = HookRow & { id?: string; deletedAt?: Date | null };

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

// Pairs each post-write row with its matching pre-write row across single and bulk actions.
export const changedPairs = (
  options: HookOptions,
): { result?: HookEntityRow; previous?: HookEntityRow }[] => {
  if (isManyAction(options.action)) {
    const { result, previous } = options as HookOptions & { action: ManyAction };
    const results = (result ?? []) as HookEntityRow[];
    const previousList = (previous ?? []) as HookEntityRow[];
    const previousById = keyBy(previousList, 'id');
    if (results.length > 0) {
      return results.map((row) => ({
        result: row,
        previous: row.id ? previousById[row.id] : undefined,
      }));
    }
    return previousList.map((row) => ({ previous: row }));
  }
  const { result, previous } = options as HookOptions & { action: SingleAction };
  return [
    {
      result: result as HookEntityRow | undefined,
      previous: previous as HookEntityRow | undefined,
    },
  ];
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
