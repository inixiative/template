/**
 * @atlas
 * @kind helper
 * @partOf primitive:flows
 * @uses none
 */
import type { Flow } from '@template/db/generated/client/client';
import { flowDefinitions } from '#/modules/flow/definitions';
import { completedStepsSchema, type FlowResponse } from '#/modules/flow/schemas/flowSchemas';
import { flowBindings } from '#/modules/flow/services/flowBindings';
import { resolveBinds } from '#/modules/flow/services/resolveBinds';

export const presentFlow = (flow: Flow): FlowResponse => {
  const { completedSteps: stored, ...row } = flow;
  const completedSteps = completedStepsSchema.parse(stored);
  const bindings = flowBindings(flow);
  return {
    ...row,
    flowSteps: flowDefinitions[flow.flowKey].steps.map((step) => ({
      key: step.key,
      label: step.label,
      mode: step.mode,
      to: step.to,
      params: resolveBinds(step.params, bindings),
      search: resolveBinds(step.search, bindings),
      hash: step.hash ?? null,
      completedAt: completedSteps.find(({ stepKey }) => stepKey === step.key)?.completedAt ?? null,
    })),
  };
};
