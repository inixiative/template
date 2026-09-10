import { DbAction, db, type HookOptions, HookTiming, Prisma, registerDbHook, type SingleAction } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import { castArray } from 'lodash-es';
import { makeError } from '#/lib/errors';
import { segmentLensFor } from '#/modules/segment/lib/segmentLens';
import { segmentOwnerFk } from '#/modules/segment/lib/segmentOwner';
import { segmentReferences } from '#/modules/segment/services/segmentReferences';
import { validateSegmentConditions } from '#/modules/segment/services/validateSegmentConditions';

type SegmentRow = Record<string, unknown>;

const isCleared = (value: unknown): boolean =>
  value === undefined || value === null || value === Prisma.DbNull || value === Prisma.JsonNull;

const ownerOf = (row: SegmentRow, previous?: SegmentRow) => {
  const ownerModel = (row.ownerModel ?? previous?.ownerModel) as Segment['ownerModel'] | undefined;
  if (!ownerModel) throw makeError({ status: 422, message: 'ownerModel is required to validate conditions' });
  const ownerFk = segmentOwnerFk(ownerModel);
  return { ownerModel, ownerFk, ownerId: (row[ownerFk] ?? previous?.[ownerFk]) as string | undefined };
};

const assertReferencesResolve = async (row: SegmentRow, previous?: SegmentRow): Promise<void> => {
  const { ownerModel, ownerFk, ownerId } = ownerOf(row, previous);
  const { ids } = segmentReferences(row.conditions as never, segmentLensFor(ownerModel));
  if (!ids.length) return;
  const live = await db.segment.findMany({
    where: { id: { in: ids }, ownerModel, [ownerFk]: ownerId, deletedAt: null },
  });
  const found = new Set(live.map((segment) => segment.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) {
    throw makeError({
      status: 422,
      message: `Invalid segment conditions: references a segment this ${ownerModel} does not own: ${missing.join(', ')}`,
    });
  }
};

const processSegmentRow = async (row: SegmentRow, previous?: SegmentRow): Promise<void> => {
  if (row.conditions === undefined && previous) return;
  if (isCleared(row.conditions)) throw makeError({ status: 422, message: 'a segment requires conditions' });

  const { ownerModel } = ownerOf(row, previous);
  const result = validateSegmentConditions(row.conditions, ownerModel, { selfId: previous?.id as string | undefined });
  if (!result.valid)
    throw makeError({ status: 422, message: `Invalid segment conditions: ${result.errors.join('; ')}` });
  row.conditions = result.normalized as Prisma.InputJsonValue;
  await assertReferencesResolve(row, previous);
};

const rowsOf = (data: unknown): SegmentRow[] => (data === undefined ? [] : (castArray(data) as SegmentRow[]));

const loadPrevious = (where: unknown): Promise<SegmentRow[]> =>
  db.segment.findMany({ where: where as Prisma.SegmentWhereInput });

export const registerSegmentConditionsHook = () => {
  registerDbHook(
    'segmentConditions:create',
    'Segment',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ args }) => {
      for (const row of rowsOf((args as { data?: unknown }).data)) await processSegmentRow(row);
    },
  );

  registerDbHook(
    'segmentConditions:update',
    'Segment',
    HookTiming.before,
    [DbAction.update, DbAction.updateManyAndReturn],
    async (options) => {
      const { args, previous } = options as HookOptions<Segment> & { previous?: Segment | Segment[] };
      const a = args as { where?: unknown; data?: unknown };
      const [row] = rowsOf(a.data);
      if (!row || row.conditions === undefined) return;
      const befores = previous ? castArray(previous) : await loadPrevious(a.where);
      for (const before of befores) await processSegmentRow(row, before);
    },
  );

  registerDbHook('segmentConditions:upsert', 'Segment', HookTiming.before, [DbAction.upsert], async (options) => {
    const { args, previous } = options as HookOptions & { action: SingleAction; previous?: Segment };
    const a = args as { where?: unknown; create?: SegmentRow; update?: SegmentRow };
    if (a.create) await processSegmentRow(a.create);
    if (a.update) {
      const before = previous ?? (await loadPrevious(a.where))[0];
      if (before) await processSegmentRow(a.update, before);
    }
  });
};
