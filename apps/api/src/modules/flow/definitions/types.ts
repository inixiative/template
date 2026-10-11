/**
 * @atlas
 * @kind type
 * @partOf primitive:flows
 * @uses none
 */
import type { Condition } from '@inixiative/json-rules';
import type { FlowKey } from '@template/db/generated/client/enums';
import type { z } from 'zod';

export const FlowStepMode = {
  navigate: 'navigate',
  anchor: 'anchor',
  action: 'action',
} as const;

export type FlowStepMode = keyof typeof FlowStepMode;

export type FlowCompletion = {
  read: string;
  path?: Record<string, string>;
  where?: Condition;
  count?: { atLeast: number };
};

export type FlowStepDefinition = {
  key: string;
  label: string;
  url: string;
  mode: FlowStepMode;
  completedWhen: FlowCompletion;
};

export type FlowParamsSchema = z.ZodObject<Record<string, z.ZodType<string>>>;

export type FlowDefinition = {
  key: FlowKey;
  paramsSchema: FlowParamsSchema;
  steps: FlowStepDefinition[];
};
