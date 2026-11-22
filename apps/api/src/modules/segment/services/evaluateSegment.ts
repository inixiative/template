/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma, primitive:shared
 */
import { andWhere, type Condition, executePrismaPlan, toPrisma } from '@inixiative/json-rules';
import { db, Prisma } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { branchOnRuleHealth, RuleDegradedError, RuleEvaluationError } from '@template/shared/rules';
import { resolvedCustomerRelationshipLens } from '#/modules/customerRelationship/lib/resolvedCustomerRelationshipLens';
import { customerRelationshipProviderFk, segmentOwnerId } from '#/modules/segment/lib/segmentOwner';
import { segmentRuleState } from '#/modules/segment/services/segmentRuleHealth';

const isInfrastructureFault = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientInitializationError ||
  error instanceof Prisma.PrismaClientRustPanicError;

export const compileSegmentWhere = async (
  ownerModel: ProviderModel,
  ownerId: string,
  rule: Condition,
): Promise<Record<string, unknown>> => {
  const plan = toPrisma(rule, {
    lens: resolvedCustomerRelationshipLens(ownerModel, ownerId),
    now: new Date(),
  });
  const where = await executePrismaPlan(plan, db as never);
  return andWhere([where, { [customerRelationshipProviderFk(ownerModel)]: ownerId }]);
};

const segmentWhere = async (segment: Segment): Promise<Record<string, unknown>> => {
  const { health, issues } = await segmentRuleState(segment);
  return branchOnRuleHealth(health, {
    degraded: () =>
      Promise.reject(new RuleDegradedError({ model: 'Segment', id: segment.id }, issues)),
    sound: (rule) => compileSegmentWhere(segment.ownerModel, segmentOwnerId(segment), rule),
  });
};

const EVALUATE_PAGE_SIZE = 2_000;

export const evaluateSegment = async (segment: Segment): Promise<string[]> => {
  try {
    const where = await segmentWhere(segment);
    const ids: string[] = [];
    let cursor: string | undefined;

    for (;;) {
      const rows = await db.customerRelationship.findMany({
        where: cursor ? andWhere([where, { id: { gt: cursor } }]) : where,
        select: { id: true },
        orderBy: { id: 'asc' },
        take: EVALUATE_PAGE_SIZE,
      });
      for (const row of rows) ids.push(row.id);
      if (rows.length < EVALUATE_PAGE_SIZE) break;
      cursor = rows[rows.length - 1]?.id;
    }

    return ids;
  } catch (error) {
    if (error instanceof RuleDegradedError || isInfrastructureFault(error)) throw error;
    throw new RuleEvaluationError(error);
  }
};
