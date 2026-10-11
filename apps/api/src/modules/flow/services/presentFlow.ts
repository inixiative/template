/**
 * @atlas
 * @kind helper
 * @partOf primitive:flows
 * @uses none
 */
import type { Flow } from '@template/db/generated/client/client';
import { flowDefinitions } from '#/modules/flow/definitions';
import { completedStepsSchema, type FlowResponse } from '#/modules/flow/schemas/flowSchemas';
import type { FlowProgress } from '#/modules/flow/services/advanceSatisfiedSteps';
import { fillFlowTemplate } from '#/modules/flow/services/fillFlowTemplate';

export const presentFlow = (flow: Flow, progress: FlowProgress): FlowResponse => {
  const { completedSteps: stored, ...row } = flow;
  const completedSteps = completedStepsSchema.parse(stored);
  const params = flow.params as Record<string, string>;
  return {
    ...row,
    flowSteps: flowDefinitions[flow.flowKey].steps.map((step) => ({
      key: step.key,
      label: step.label,
      url: fillFlowTemplate(step.url, params),
      mode: step.mode,
      completedAt: completedSteps.find(({ stepKey }) => stepKey === step.key)?.completedAt ?? null,
    })),
    progress,
  };
};
