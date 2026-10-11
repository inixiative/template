/**
 * @atlas
 * @kind query
 * @partOf primitive:flows
 * @uses infrastructure:prisma
 */
import { Prisma } from '@template/db';

export const includeFlowSteps = {
  flowSteps: { orderBy: { order: Prisma.SortOrder.asc } },
} satisfies Prisma.FlowInclude;
