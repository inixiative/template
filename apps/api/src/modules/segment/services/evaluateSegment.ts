/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { applyLens, type Condition, executePrismaQueryPlan, toPrisma } from '@inixiative/json-rules';
import { type Db, db as defaultDb, Prisma } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import { rootLens } from '@template/db/lens';
import { resolvedSegmentLens } from '#/modules/segment/lib/segmentLens';
import { customerRefProviderFk, segmentOwnerId } from '#/modules/segment/lib/segmentOwner';

export class SegmentRuleEvaluationError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'SegmentRuleEvaluationError';
    this.cause = cause;
  }
}

const isInfrastructureFault = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientInitializationError || error instanceof Prisma.PrismaClientRustPanicError;

const segmentWhere = async (segment: Segment, db: Db = defaultDb): Promise<Record<string, unknown>> => {
  const ownerId = segmentOwnerId(segment);
  const lens = resolvedSegmentLens(segment.ownerModel, ownerId);
  const root = rootLens(lens);
  const plan = toPrisma(applyLens(segment.conditions as Condition, lens), {
    map: root,
    mapName: root.mapName,
    model: root.model,
    now: new Date(),
  });
  const where = await executePrismaQueryPlan(plan, db as never);
  return { AND: [where, { [customerRefProviderFk(segment.ownerModel)]: ownerId }] };
};

export const evaluateSegment = async (segment: Segment, db: Db = defaultDb): Promise<string[]> => {
  try {
    const where = await segmentWhere(segment, db);
    const rows = await db.customerRef.findMany({ where, select: { id: true } });
    return rows.map((row) => row.id);
  } catch (error) {
    if (isInfrastructureFault(error)) throw error;
    throw new SegmentRuleEvaluationError(error);
  }
};

export const estimateSegmentReach = async (segment: Segment, db: Db = defaultDb): Promise<number> =>
  db.customerRef.count({ where: await segmentWhere(segment, db) });
