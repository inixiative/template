/**
 * @atlas
 * @kind helper
 * @partOf feature:auditLogs, feature:webhooks
 */
import { DbAction, type ManyAction } from '@template/db';
import { castArray, compact } from 'lodash-es';

export type HookRow = Record<string, unknown>;

export const isManyAction = (action: DbAction): action is ManyAction =>
  action === DbAction.createManyAndReturn || action === DbAction.updateManyAndReturn || action === DbAction.deleteMany;

export const buildPreviousById = (previous: unknown): Map<string, HookRow> =>
  new Map(
    compact(castArray(previous) as (HookRow | undefined)[])
      .filter((row) => typeof row.id === 'string')
      .map((row) => [row.id as string, row]),
  );
