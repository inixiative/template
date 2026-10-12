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

export type FlowDefinition<TBindings extends z.ZodObject = z.ZodObject> = {
  key: FlowKey;
  bindingsSchema: TBindings;
  steps(bindings: z.infer<TBindings>, now: Date): Promise<FlowStep[]>;
};

export const flowRegistry: Record<FlowKey, FlowDefinition> = {
  setUpOrganization: setUpOrganizationFlow,
};
