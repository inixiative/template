/**
 * @atlas
 * @kind schema
 * @partOf primitive:flows
 * @uses primitive:shared
 */
import { z } from '@hono/zod-openapi';
import type { Condition } from '@inixiative/json-rules';
import { FlowScalarSchema } from '@template/db';
import { FlowKey } from '@template/db/generated/client/enums';
import { FlowStepAdvance, FlowStepState } from '@template/shared/flows';
import { appPathSchema } from '@template/shared/utils';

export const flowStepSchema = z.object({
  key: z.string(),
  label: z.string(),
  to: appPathSchema.nullable(),
  advance: z.enum(FlowStepAdvance),
  readPath: z.string(),
  rule: z.record(z.string(), z.unknown()),
});

export type FlowStep = Omit<z.infer<typeof flowStepSchema>, 'rule'> & { rule: Condition };

export const flowCreateBodySchema = z.object({
  flowKey: z.enum(FlowKey),
  bindings: z.record(z.string(), z.unknown()).default({}),
});

export const flowResponseSchema = FlowScalarSchema.extend({
  steps: z.array(flowStepSchema),
  stepStates: z.array(z.enum(FlowStepState)),
  currentStep: z.number().int(),
}).openapi('Flow');
