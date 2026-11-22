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
import { fetchAllAsCaller } from '#/modules/batch/services/fetchAllAsCaller';
import type { FlowStep } from '#/modules/flow/schemas/flowSchemas';
import type { AppEnv } from '#/types/appEnv';

const READ_ALL = { pageSize: 1000, maxPages: 10 };
const TERMINAL_STEP_STATUSES = new Set([401, 403, 404]);

const isTerminalFlowStepError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const typed = error as { status?: unknown; capped?: unknown };
  if (typeof typed.status === 'number') return TERMINAL_STEP_STATUSES.has(typed.status);
  return typed.capped === true;
};

export const advanceFlowAndDeleteWhenFinished = async (c: Context<AppEnv>, flow: Flow) => {
  const db = c.get('db');
  const steps = flow.steps as FlowStep[];
  const stepStates: FlowStepState[] = steps.map(() => FlowStepState.pending);
  let currentStep = 0;

  try {
    const dataByPath = new Map<string, unknown>();
    for (const step of steps) {
      let data = dataByPath.get(step.readPath);
      if (!dataByPath.has(step.readPath)) {
        data = await fetchAllAsCaller(c, step.readPath, READ_ALL);
        dataByPath.set(step.readPath, data);
      }
      if (check(step.rule, { data }) !== true) break;
      stepStates[currentStep++] = FlowStepState.done;
    }
  } catch (error) {
    if (!isTerminalFlowStepError(error)) throw error;
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
