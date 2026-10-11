/**
 * @atlas
 * @kind service
 * @partOf primitive:flows
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { Flow } from '@template/db/generated/client/client';
import { includeFlowSteps } from '#/modules/flow/queries/flowIncludes';
import { lockFlow } from '#/modules/flow/services/lockFlow';
import {
  validateFlowIsAtStep,
  validateFlowIsOpen,
} from '#/modules/flow/validations/validateFlowStatus';

const completeStep = async (flow: Flow, currentStep: number) => {
  validateFlowIsOpen(flow);
  validateFlowIsAtStep(flow, currentStep);

  const completedAt = new Date();
  const stepCount = await db.flowStep.count({ where: { flowId: flow.id } });
  const nextStep = currentStep + 1;

  await db.flowStep.update({
    where: { flowId_order: { flowId: flow.id, order: currentStep } },
    data: { completedAt },
  });
  await db.flow.update({
    where: { id: flow.id },
    data: { currentStep: nextStep, completedAt: nextStep === stepCount ? completedAt : null },
  });
};

export const advanceFlow = (flowId: string, currentStep: number) =>
  db.txn(async () => {
    const flow = await lockFlow(flowId);
    const alreadyAdvanced = currentStep < flow.currentStep;
    if (!alreadyAdvanced) await completeStep(flow, currentStep);

    return db.flow.findUniqueOrThrow({ where: { id: flowId }, include: includeFlowSteps });
  });
