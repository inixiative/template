/**
 * @atlas
 * @kind service
 * @partOf primitive:flows
 * @uses none
 */
import type { Context } from 'hono';
import { type FlowStep, FlowStepState } from '#/modules/flow/schemas/flowSchemas';
import { stepHolds } from '#/modules/flow/services/stepHolds';
import type { AppEnv } from '#/types/appEnv';

export const checkSteps = async (c: Context<AppEnv>, steps: FlowStep[]) => {
  const stepStates = steps.map((): keyof typeof FlowStepState => FlowStepState.pending);
  for (const [index, step] of steps.entries()) {
    if (!(await stepHolds(c, step))) return { stepStates, currentStep: index };
    stepStates[index] = FlowStepState.done;
  }
  return { stepStates, currentStep: steps.length };
};
