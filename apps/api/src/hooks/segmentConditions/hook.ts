import type { Condition } from '@inixiative/json-rules';
import { DbAction, db, type HookOptions, HookTiming, Prisma, registerDbHook, type SingleAction } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import { castArray } from 'lodash-es';
import { makeError } from '#/lib/errors';
import { invalidSegmentConditions } from '#/modules/segment/lib/invalidSegmentConditions';
import { validateSegmentConditions } from '#/modules/segment/validations/validateSegmentConditions';
import { validateSegmentReferences } from '#/modules/segment/validations/validateSegmentReferences';

type SegmentRow = Partial<Omit<Segment, 'conditions'>> & { conditions?: unknown };

const isCleared = (value: unknown): boolean =>
  value === undefined || value === null || value === Prisma.DbNull || value === Prisma.JsonNull;

const validateRow = async (row: SegmentRow, previous?: Segment): Promise<void> => {
  if (row.conditions === undefined && previous) return;
  if (isCleared(row.conditions)) throw makeError({ status: 422, message: 'a segment requires conditions' });

  const owner = previous ?? (row as Segment);
  const result = validateSegmentConditions(row.conditions, owner.ownerModel, { selfId: previous?.id });
  if (!result.valid) throw invalidSegmentConditions(result.errors);
  row.conditions = result.normalized;
  await validateSegmentReferences(owner, result.normalized as Condition, previous);
};

export const registerSegmentConditionsHook = () => {
  registerDbHook(
    'segmentConditions:create',
    'Segment',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ args }) => {
      for (const row of castArray((args as { data: SegmentRow | SegmentRow[] }).data)) await validateRow(row);
    },
  );

  registerDbHook(
    'segmentConditions:update',
    'Segment',
    HookTiming.before,
    [DbAction.update, DbAction.updateManyAndReturn],
    async (options) => {
      const { args, previous } = options as HookOptions<Segment> & { previous?: Segment | Segment[] };
      const a = args as { where?: Prisma.SegmentWhereInput; data?: SegmentRow | SegmentRow[] };
      const [row] = castArray(a.data ?? []);
      if (!row || row.conditions === undefined) return;
      const befores = previous ? castArray(previous) : await db.segment.findMany({ where: a.where });
      for (const before of befores) await validateRow(row, before);
    },
  );

  registerDbHook('segmentConditions:upsert', 'Segment', HookTiming.before, [DbAction.upsert], async (options) => {
    const { args, previous } = options as HookOptions & { action: SingleAction; previous?: Segment };
    const a = args as { where?: Prisma.SegmentWhereInput; create?: SegmentRow; update?: SegmentRow };
    if (a.create) await validateRow(a.create);
    if (a.update) {
      const before = previous ?? (await db.segment.findMany({ where: a.where }))[0];
      if (before) await validateRow(a.update, before);
    }
  });
};
