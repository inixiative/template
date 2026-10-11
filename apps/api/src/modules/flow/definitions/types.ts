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

export type FlowBind = { bind: string };

export type FlowBound = Record<string, FlowBind>;

export type FlowCompletion = {
  read: string;
  path?: FlowBound;
  query?: FlowBound;
  rule: Condition;
};

export type FlowStepDefinition = {
  key: string;
  label: string;
  mode: FlowStepMode;
  to: string;
  params?: FlowBound;
  search?: FlowBound;
  hash?: string;
  completedWhen: FlowCompletion;
};

export type FlowBindingsSchema = z.ZodObject<Record<string, z.ZodType<string>>>;

export type FlowDefinition = {
  key: FlowKey;
  bindingsSchema: FlowBindingsSchema;
  steps: FlowStepDefinition[];
};
