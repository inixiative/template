/**
 * @atlas
 * @kind service
 * @partOf primitive:flows
 * @uses infrastructure:prisma
 */
import type { Flow } from '@template/db/generated/client/client';
import { log } from '@template/shared/logger';
import type { Context } from 'hono';
import { checkSteps } from '#/modules/flow/services/checkSteps';
import { parseFlow } from '#/modules/flow/services/parseFlow';
import type { AppEnv } from '#/types/appEnv';

export const recheckFlow = async (c: Context<AppEnv>, flow: Flow) => {
  const db = c.get('db');
  const { steps } = parseFlow(flow);

  const checked = await checkSteps(c, steps).catch((error: unknown) => {
    log.warn(`flow ${flow.id} dropped: ${String(error)}`);
    return null;
  });
  if (!checked || checked.currentStep === steps.length) {
    await db.flow.deleteMany({ where: { id: flow.id } });
    return checked && { ...flow, steps, ...checked };
  }

  const [touched] = await db.flow.updateManyAndReturn({
    where: { id: flow.id },
    data: { updatedAt: new Date() },
  });
  return touched ? { ...touched, steps, ...checked } : null;
};
