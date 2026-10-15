/**
 * @atlas
 * @kind utils
 * @partOf primitive:routeTemplates
 * @uses none
 */
import { z } from 'zod';

export type JsonSchema = Record<string, unknown>;

export const toJsonSchema = (schema: z.ZodType, io: 'input' | 'output'): JsonSchema =>
  z.toJSONSchema(schema, { io, unrepresentable: 'any' }) as JsonSchema;
