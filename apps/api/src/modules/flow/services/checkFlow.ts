/**
 * @atlas
 * @kind service
 * @partOf primitive:flows
 * @uses infrastructure:prisma, primitive:batch, primitive:errors
 */
import { check } from '@inixiative/json-rules';
import type { Flow } from '@template/db/generated/client/client';
import { FlowStepState } from '@template/shared/flows';
import { log } from '@template/shared/logger';
import type { Context } from 'hono';
import { makeError } from '#/lib/errors';
import { readAllAsCaller } from '#/modules/batch/services/readAllAsCaller';
import type { FlowStep } from '#/modules/flow/schemas/flowSchemas';
import type { AppEnv } from '#/types/appEnv';

const READ_ALL = { pageSize: 1000, maxPages: 10 };

export const checkFlow = async (c: Context<AppEnv>, flow: Flow) => {
  const db = c.get('db');
  const steps = flow.steps as FlowStep[];
  const stepStates: FlowStepState[] = steps.map(() => FlowStepState.pending);
  let currentStep = 0;

  try {
    for (const step of steps) {
      const data = await readAllAsCaller(c, step.readPath, READ_ALL);
      if (check(step.rule, { data }) !== true) break;
      stepStates[currentStep++] = FlowStepState.done;
    }
  } catch (error) {
    log.warn(`flow ${flow.id} dropped: ${String(error)}`);
    await db.flow.delete({ where: { id: flow.id } });
    throw makeError({ status: 404, message: 'Flow ended' });
  }

  const checked =
    currentStep === steps.length
      ? await db.flow.delete({ where: { id: flow.id } })
      : await db.flow.update({ where: { id: flow.id }, data: { updatedAt: new Date() } });
  return { ...checked, steps, stepStates, currentStep };
};
