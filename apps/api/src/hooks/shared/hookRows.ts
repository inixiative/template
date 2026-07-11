/**
 * @atlas
 * @kind helper
 * @partOf feature:auditLogs, feature:webhooks
 */
import { DbAction, type ManyAction } from '@template/db';

export type HookRow = Record<string, unknown>;

export const toArray = (value: unknown): HookRow[] =>
  (Array.isArray(value) ? value : value ? [value] : []) as HookRow[];

export const isManyAction = (action: DbAction): action is ManyAction =>
  action === DbAction.createManyAndReturn || action === DbAction.updateManyAndReturn || action === DbAction.deleteMany;

export const buildPreviousById = (previous: unknown): Map<string, HookRow> =>
  new Map(
    toArray(previous)
      .filter((row) => typeof row.id === 'string')
      .map((row) => [row.id as string, row]),
  );
