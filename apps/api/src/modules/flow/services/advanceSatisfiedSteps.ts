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
import { evaluateFlowStep, type FlowStepState } from '#/modules/flow/services/evaluateFlowStep';
import { flowBindings } from '#/modules/flow/services/flowBindings';
import type { AppEnv } from '#/types/appEnv';

export const advanceSatisfiedSteps = async (
  c: Context<AppEnv>,
  flow: Flow,
): Promise<{ flow: Flow; currentStepState: FlowStepState | null }> => {
  const { steps } = flowDefinitions[flow.flowKey];
  const completedSteps = completedStepsSchema.parse(flow.completedSteps);
  let current = flow;

  for (;;) {
    const step = steps[current.currentStep];
    if (!step || current.completedAt || current.canceledAt)
      return { flow: current, currentStepState: null };
    const state = await evaluateFlowStep(c, step.completedWhen, flowBindings(current));
    if (state !== 'holds') return { flow: current, currentStepState: state };

    const completedAt = new Date();
    completedSteps.push({ stepKey: step.key, completedAt: completedAt.toISOString() });
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
