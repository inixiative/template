/**
 * @atlas
 * @kind helper
 * @partOf feature:auditLogs, feature:webhooks
 */
import { DbAction, type HookOptions, type ManyAction } from '@template/db';
import { castArray, isPlainObject } from 'lodash-es';

export type HookRow = Record<string, unknown>;

export const isManyAction = (action: DbAction): action is ManyAction =>
  action === DbAction.createManyAndReturn ||
  action === DbAction.updateManyAndReturn ||
  action === DbAction.deleteMany;

// What the write itself carries, per row, with no pre-image merged in: `data` for create, update
// and the *AndReturn forms, both arms for upsert. A guard that judges only the values being
// written reads these.
export const writtenPatches = ({ action, args }: HookOptions): HookRow[] => {
  const { data, create, update } = (args ?? {}) as {
    data?: unknown;
    create?: unknown;
    update?: unknown;
  };
  const written = action === DbAction.upsert ? [create, update] : castArray(data);
  return written.filter((row): row is HookRow => isPlainObject(row));
};
