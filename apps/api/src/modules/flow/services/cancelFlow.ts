/**
 * @atlas
 * @kind service
 * @partOf primitive:flows
 * @uses infrastructure:prisma, primitive:errors
 */
import { db } from '@template/db';
import { makeError } from '#/lib/errors';
import { lockFlow } from '#/modules/flow/services/lockFlow';
import { presentFlow } from '#/modules/flow/services/presentFlow';

export const cancelFlow = (flowId: string) =>
  db.txn(async () => {
    const flow = await lockFlow(flowId);
    if (flow.canceledAt) return presentFlow(flow);
    if (flow.completedAt) throw makeError({ status: 409, message: 'Flow is already complete' });
    return presentFlow(
      await db.flow.update({ where: { id: flowId }, data: { canceledAt: new Date() } }),
    );
  });
