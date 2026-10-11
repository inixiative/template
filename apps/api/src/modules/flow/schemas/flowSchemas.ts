/**
 * @atlas
 * @kind schema
 * @partOf primitive:flows
 * @uses none
 */
import { FlowScalarSchema, FlowStepScalarSchema } from '@template/db';
import { z } from 'zod';
import { isAppPath } from '#/modules/flow/validations/isAppPath';

export const flowUrlSchema = z
  .string()
  .max(2048)
  .refine(isAppPath, { message: 'Must be a path inside this app, starting with a single /' });

export const flowStepCreateSchema = z.object({
  label: z.string().trim().min(1).max(200),
  url: flowUrlSchema,
  data: z.record(z.string(), z.unknown()).optional(),
});

export const flowCreateBodySchema = z.object({
  returnUrl: flowUrlSchema,
  flowSteps: z.array(flowStepCreateSchema).min(1).max(50),
});

export const flowAdvanceBodySchema = z.object({
  currentStep: z.number().int().min(0),
});

export const flowResponseSchema = FlowScalarSchema.extend({
  flowSteps: FlowStepScalarSchema.array(),
});
