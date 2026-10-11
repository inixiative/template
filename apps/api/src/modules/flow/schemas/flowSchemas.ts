/**
 * @atlas
 * @kind schema
 * @partOf primitive:flows
 * @uses none
 */
import { FlowScalarSchema } from '@template/db';
import { FlowKey } from '@template/db/generated/client/enums';
import { z } from 'zod';
import { FlowStepMode } from '#/modules/flow/definitions/types';
import { isAppPath } from '#/modules/flow/validations/isAppPath';

export const flowUrlSchema = z
  .string()
  .max(2048)
  .refine(isAppPath, { message: 'Must be a path inside this app, starting with a single /' });

export const flowCreateBodySchema = z.object({
  flowKey: z.enum(FlowKey),
  bindings: z.record(z.string(), z.string()).default({}),
  returnUrl: flowUrlSchema,
});

export const completedStepsSchema = z.array(
  z.object({ stepKey: z.string(), completedAt: z.string() }),
);

export type CompletedSteps = z.infer<typeof completedStepsSchema>;

export const flowResponseSchema = FlowScalarSchema.omit({ completedSteps: true }).extend({
  flowSteps: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      mode: z.enum(FlowStepMode),
      to: z.string(),
      params: z.record(z.string(), z.string()),
      search: z.record(z.string(), z.string()),
      hash: z.string().nullable(),
      completedAt: z.string().nullable(),
    }),
  ),
});

export type FlowResponse = z.infer<typeof flowResponseSchema>;
