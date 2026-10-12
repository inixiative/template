/**
 * @atlas
 * @kind schema
 * @partOf primitive:flows
 * @uses none
 */
import { z } from '@hono/zod-openapi';
import { FlowScalarSchema } from '@template/db';
import { FlowKey } from '@template/db/generated/client/enums';
import { isAppPath } from '#/modules/flow/validations/isAppPath';

export const FlowStepAdvance = { auto: 'auto', confirm: 'confirm' } as const;
export type FlowStepAdvance = keyof typeof FlowStepAdvance;

export const FlowStepState = { done: 'done', pending: 'pending' } as const;

export const flowUrlSchema = z
  .string()
  .max(2048)
  .refine(isAppPath, { message: 'Must be a path inside this app, starting with a single /' });

export const flowStepSchema = z.object({
  key: z.string(),
  label: z.string(),
  to: flowUrlSchema.nullable(),
  advance: z.enum(FlowStepAdvance),
  readPath: z.string(),
  rule: z.record(z.string(), z.unknown()),
});

export const flowStepsSchema = z.array(flowStepSchema);
export const flowStepStatesSchema = z.array(z.enum(FlowStepState));

export type FlowStep = z.infer<typeof flowStepSchema>;

export const flowCreateBodySchema = z.object({
  flowKey: z.enum(FlowKey),
  bindings: z.record(z.string(), z.unknown()).default({}),
});

export const flowResponseSchema = FlowScalarSchema.extend({
  steps: flowStepsSchema,
  stepStates: flowStepStatesSchema,
  currentStep: z.number().int(),
}).openapi('Flow');
