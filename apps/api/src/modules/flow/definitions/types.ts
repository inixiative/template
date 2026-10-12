/**
 * @atlas
 * @kind type
 * @partOf primitive:flows
 * @uses none
 */
import type { Condition } from '@inixiative/json-rules';
import type { FlowKey } from '@template/db/generated/client/enums';
import type { z } from 'zod';
import type { FlowStepAdvance } from '#/modules/flow/schemas/flowSchemas';

export type FlowStepInput = {
  key: string;
  label: string;
  to?: string;
  advance: FlowStepAdvance;
  read: {
    operationId: string;
    path?: Record<string, string>;
    query?: Record<string, unknown>;
  };
  rule: Condition;
};

export type FlowDefinition<TBindings extends z.ZodObject = z.ZodObject> = {
  key: FlowKey;
  bindingsSchema: TBindings;
  steps(bindings: z.infer<TBindings>, now: Date): FlowStepInput[];
};
