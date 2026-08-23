/**
 * @atlas
 * @kind helper
 * @partOf feature:auditLogs, feature:webhooks
 */
import { DbAction, type ManyAction } from '@template/db';

export type HookRow = Record<string, unknown>;

export const isManyAction = (action: DbAction): action is ManyAction =>
  action === DbAction.createManyAndReturn || action === DbAction.updateManyAndReturn || action === DbAction.deleteMany;

export const buildPreviousById = (previous: HookRow[] | undefined): Map<string, HookRow> =>
  new Map((previous ?? []).map((row) => [row.id as string, row]));
