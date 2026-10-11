/**
 * @atlas
 * @kind service
 * @partOf primitive:flows
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { Context } from 'hono';
import { advanceSatisfiedSteps } from '#/modules/flow/services/advanceSatisfiedSteps';
import { lockFlow } from '#/modules/flow/services/lockFlow';
import { presentFlow } from '#/modules/flow/services/presentFlow';
import type { AppEnv } from '#/types/appEnv';

export const checkFlow = (c: Context<AppEnv>, flowId: string) =>
  db.txn(async () => {
    const locked = await lockFlow(flowId);
    const { flow, progress } = await advanceSatisfiedSteps(c, locked);
    return presentFlow(flow, progress);
  });
