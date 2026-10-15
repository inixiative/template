/**
 * @atlas
 * @kind schema
 * @partOf feature:segment
 * @uses none
 */
import { z } from '@hono/zod-openapi';

const operatorsByKindSchema = z.record(z.string(), z.array(z.string()));

export const segmentInfoResponseSchema = z.object({
  root: z.string(),
  example: z.unknown(),
  examples: z.array(z.unknown()),
  nodes: z.array(
    z.object({
      kind: z.enum(['all', 'any', 'ifThenElse', 'rule', 'date', 'array', 'aggregate', 'boolean']),
      required: z.array(z.string()),
      optional: z.array(z.string()),
      description: z.string(),
      example: z.unknown(),
    }),
  ),
  operators: z.object({
    field: operatorsByKindSchema,
    date: operatorsByKindSchema,
    array: z.array(z.string()),
    aggregate: z.array(z.string()),
  }),
  valueShapes: z.object({
    field: z.record(z.string(), z.string()),
    date: z.record(z.string(), z.string()),
    array: z.record(z.string(), z.string()),
  }),
  fields: z.array(
    z.object({
      path: z.string(),
      model: z.string(),
      kind: z.string(),
      type: z.string(),
      isList: z.boolean(),
      values: z.array(z.string()),
      sourced: z.boolean(),
    }),
  ),
});
