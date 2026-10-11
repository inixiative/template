/**
 * @atlas
 * @kind service
 * @partOf primitive:flows
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import { includeFlowSteps } from '#/modules/flow/queries/flowIncludes';
import { lockFlow } from '#/modules/flow/services/lockFlow';
import { validateFlowIsOpen } from '#/modules/flow/validations/validateFlowStatus';

export const cancelFlow = (flowId: string) =>
  db.txn(async () => {
    const flow = await lockFlow(flowId);
    if (!flow.canceledAt) {
      validateFlowIsOpen(flow);
      await db.flow.update({ where: { id: flowId }, data: { canceledAt: new Date() } });
    }

    return db.flow.findUniqueOrThrow({ where: { id: flowId }, include: includeFlowSteps });
  });
