/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma, primitive:shared
 */
import { applyLens, type Condition, executePrismaQueryPlan, toPrisma } from '@inixiative/json-rules';
import { db, Prisma } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { rootLens } from '@template/db/lens';
import { RuleDegradedError, RuleEvaluationError, withRule } from '@template/shared/rules';
import { resolvedCustomerRefLens } from '#/modules/customerRef/lib/customerRefLens';
import { customerRefProviderFk, segmentOwnerId } from '#/modules/segment/lib/segmentOwner';
import { segmentRuleState } from '#/modules/segment/services/segmentRuleHealth';

const isInfrastructureFault = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientInitializationError || error instanceof Prisma.PrismaClientRustPanicError;

export const compileSegmentWhere = async (
  ownerModel: ProviderModel,
  ownerId: string,
  rule: Condition,
): Promise<Record<string, unknown>> => {
  const lens = resolvedCustomerRefLens(ownerModel, ownerId);
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

const segmentWhere = async (segment: Segment): Promise<Record<string, unknown>> => {
  const { health, issues } = await segmentRuleState(segment);
  return withRule(health, {
    degraded: () => Promise.reject(new RuleDegradedError({ model: 'Segment', id: segment.id }, issues)),
    sound: (rule) => compileSegmentWhere(segment.ownerModel, segmentOwnerId(segment), rule),
  });
};

export const evaluateSegment = async (segment: Segment): Promise<string[]> => {
  try {
    const where = await segmentWhere(segment);
    const rows = await db.customerRef.findMany({ where, select: { id: true } });
    return rows.map((row) => row.id);
  } catch (error) {
    if (error instanceof RuleDegradedError || isInfrastructureFault(error)) throw error;
    throw new RuleEvaluationError(error);
  }
};
