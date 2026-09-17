/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma, primitive:shared
 */
import { applyLens, type Condition, executePrismaQueryPlan, toPrisma } from '@inixiative/json-rules';
import { type Db, db as defaultDb, Prisma } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { rootLens } from '@template/db/lens';
import { type RuleIssue, withRule } from '@template/shared/rules';
import { resolvedSegmentLens } from '#/modules/segment/lib/segmentLens';
import { customerRefProviderFk, segmentOwnerId } from '#/modules/segment/lib/segmentOwner';
import { segmentRuleEdges, segmentRuleHealth } from '#/modules/segment/services/segmentRuleHealth';

export class SegmentRuleEvaluationError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'SegmentRuleEvaluationError';
    this.cause = cause;
  }
}

export class SegmentRuleDegradedError extends Error {
  readonly issues: RuleIssue[];

  constructor(segmentId: string, issues: RuleIssue[]) {
    super(`segment ${segmentId} rule is degraded: ${issues.map((issue) => issue.detail).join('; ')}`);
    this.name = 'SegmentRuleDegradedError';
    this.issues = issues;
  }
}

const isInfrastructureFault = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientInitializationError || error instanceof Prisma.PrismaClientRustPanicError;

export const compileSegmentWhere = async (
  ownerModel: ProviderModel,
  ownerId: string,
  rule: Condition,
  db: Db,
): Promise<Record<string, unknown>> => {
  const lens = resolvedSegmentLens(ownerModel, ownerId);
  const root = rootLens(lens);
  const plan = toPrisma(applyLens(rule, lens), {
    map: root,
    mapName: root.mapName,
    model: root.model,
    now: new Date(),
  });
  const where = await executePrismaQueryPlan(plan, db as never);
  return { AND: [where, { [customerRefProviderFk(ownerModel)]: ownerId }] };
};

const segmentWhere = async (segment: Segment, db: Db = defaultDb): Promise<Record<string, unknown>> =>
  withRule(segmentRuleHealth(segment, await segmentRuleEdges(segment.id, db)), {
    degraded: (issues) => Promise.reject(new SegmentRuleDegradedError(segment.id, issues)),
    sound: (rule) => compileSegmentWhere(segment.ownerModel, segmentOwnerId(segment), rule, db),
  });

export const evaluateSegment = async (segment: Segment, db: Db = defaultDb): Promise<string[]> => {
  try {
    const where = await segmentWhere(segment, db);
    const rows = await db.customerRef.findMany({ where, select: { id: true } });
    return rows.map((row) => row.id);
  } catch (error) {
    if (error instanceof SegmentRuleDegradedError || isInfrastructureFault(error)) throw error;
    throw new SegmentRuleEvaluationError(error);
  }
};
