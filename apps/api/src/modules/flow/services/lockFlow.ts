/**
 * @atlas
 * @kind service
 * @partOf primitive:flows
 * @uses infrastructure:prisma, primitive:errors
 */
import { db } from '@template/db';
import type { Flow } from '@template/db/generated/client/client';
import { makeError } from '#/lib/errors';

export const lockFlow = async (flowId: string): Promise<Flow> => {
  const [flow] = await db.findForUpdate<Flow>('Flow', { id: flowId });
  if (!flow) throw makeError({ status: 404, message: 'Flow not found' });
  return flow;
};
