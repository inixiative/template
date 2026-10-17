/**
 * @atlas
 * @kind registry
 * @partOf primitive:flows
 * @uses none
 */
import type { FlowKey } from '@template/db/generated/client/enums';
import type { z } from 'zod';
import { setUpOrganizationFlow } from '#/modules/flow/registry/setUpOrganization';
import type { FlowStep } from '#/modules/flow/schemas/flowSchemas';

export type FlowStepsContext = { userId: string; now: Date };

export type FlowDefinition<
  TBindings extends z.ZodType<Record<string, unknown>> = z.ZodType<Record<string, unknown>>,
> = {
  key: FlowKey;
  bindingsSchema: TBindings;
  steps(bindings: z.infer<TBindings>, context: FlowStepsContext): Promise<FlowStep[]>;
};

export const flowRegistry: Record<FlowKey, FlowDefinition> = {
  setUpOrganization: setUpOrganizationFlow,
};
