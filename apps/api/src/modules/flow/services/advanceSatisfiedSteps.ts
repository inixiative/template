/**
 * @atlas
 * @kind service
 * @partOf primitive:flows
 * @uses infrastructure:prisma
 */
import { db, type Prisma } from '@template/db';
import type { Flow } from '@template/db/generated/client/client';
import type { Context } from 'hono';
import { flowDefinitions } from '#/modules/flow/definitions';
import { completedStepsSchema } from '#/modules/flow/schemas/flowSchemas';
import { countFlowStepRows } from '#/modules/flow/services/countFlowStepRows';
import { flowBindings } from '#/modules/flow/services/flowBindings';
import type { AppEnv } from '#/types/appEnv';

export type FlowProgress = { count: number; required: number } | null;

export type FlowStepVisibility = 'visible' | 'refused';

export const currentStepProgress = async (
  c: Context<AppEnv>,
  flow: Flow,
): Promise<{ progress: FlowProgress; visibility: FlowStepVisibility }> => {
  const step = flowDefinitions[flow.flowKey].steps[flow.currentStep];
  if (!step || flow.completedAt || flow.canceledAt)
    return { progress: null, visibility: 'visible' };
  const count = await countFlowStepRows(c, step.completedWhen, flowBindings(flow));
  return {
    progress: { count: count ?? 0, required: step.completedWhen.count?.atLeast ?? 1 },
    visibility: count === null ? 'refused' : 'visible',
  };
};

export const advanceSatisfiedSteps = async (
  c: Context<AppEnv>,
  flow: Flow,
): Promise<{ flow: Flow; progress: FlowProgress; visibility: FlowStepVisibility }> => {
  const { steps } = flowDefinitions[flow.flowKey];
  const completedSteps = completedStepsSchema.parse(flow.completedSteps);
  let current = flow;

  for (;;) {
    const { progress, visibility } = await currentStepProgress(c, current);
    if (!progress || progress.count < progress.required)
      return { flow: current, progress, visibility };

    const completedAt = new Date();
    completedSteps.push({
      stepKey: steps[current.currentStep]!.key,
      completedAt: completedAt.toISOString(),
    });
    const currentStep = current.currentStep + 1;
    current = await db.flow.update({
      where: { id: current.id },
      data: {
        currentStep,
        completedSteps: completedSteps as Prisma.InputJsonValue,
        completedAt: currentStep === steps.length ? completedAt : null,
      },
    });
  }
};
