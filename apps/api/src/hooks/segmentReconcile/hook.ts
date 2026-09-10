import { DbAction, db, type HookOptions, HookTiming, isNoOpUpdate, NOOP_FIELDS, registerDbHook } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import { SegmentType } from '@template/db/generated/client/enums';
import { ConcurrencyType } from '@template/shared/utils';
import { castArray, isEqual } from 'lodash-es';
import { enqueueJob } from '#/jobs/enqueue';
import { customerRefIdsForRows, segmentTriggerModels } from '#/modules/segment/services/customerRefIdsForRows';

type Row = Record<string, unknown> & { id: string };

const ACTIONS = [
  DbAction.create,
  DbAction.update,
  DbAction.delete,
  DbAction.upsert,
  DbAction.createManyAndReturn,
  DbAction.updateManyAndReturn,
  DbAction.deleteMany,
];

const previousById = (previous: unknown): Map<string, Row> =>
  new Map((castArray(previous ?? []) as Row[]).map((row) => [row.id, row]));

const changedRows = (options: HookOptions): Row[] => {
  const rows = castArray(options.result ?? []) as Row[];
  const before = previousById(options.previous);
  return rows.filter((row) => !isNoOpUpdate(options.model, row, before.get(row.id), NOOP_FIELDS));
};

const segmentNeedsReconcile = (segment: Segment, previous?: Segment): boolean => {
  if (segment.deletedAt || !segment.conditions) return false;
  if (!previous) return true;
  return (
    !isEqual(previous.conditions, segment.conditions) ||
    (segment.type === SegmentType.dynamic && previous.type !== segment.type) ||
    (!!previous.reconcilePausedAt && !segment.reconcilePausedAt)
  );
};

const enqueueSegments = (segments: Segment[], before: Map<string, Row>) =>
  segments
    .filter((segment) => segmentNeedsReconcile(segment, before.get(segment.id) as Segment | undefined))
    .map((segment) => async () => {
      await enqueueJob('reconcileSegment', { segmentId: segment.id });
    });

export const registerSegmentReconcileHook = () => {
  registerDbHook('segmentReconcile', '*', HookTiming.after, ACTIONS, async (options) => {
    const { model } = options;
    if (!segmentTriggerModels.has(model)) return;

    let customerRefIds: string[] = [];
    let callbacks: (() => Promise<void>)[] = [];

    if (model === 'Segment') {
      callbacks = enqueueSegments(castArray(options.result ?? []) as Segment[], previousById(options.previous));
    } else if (model !== 'SegmentMember') {
      const rows =
        options.action === DbAction.delete || options.action === DbAction.deleteMany
          ? (castArray(options.result ?? []) as Row[])
          : changedRows(options);
      customerRefIds = await customerRefIdsForRows(model, rows, db);
    }

    callbacks.push(
      ...customerRefIds.map((customerRefId) => async () => {
        await enqueueJob('reconcileCustomerRefSegments', { customerRefId });
      }),
    );
    if (!callbacks.length) return;

    db.onCommit(callbacks, ConcurrencyType.queue);
  });
};
