/**
 * @atlas
 * @kind utils
 * @partOf primitive:routeTemplates
 * @uses none
 */
import type { z } from 'zod';
import { type JsonSchema, toJsonSchema } from '#/lib/jsonSchema/toJsonSchema';

export type SchemaGuide = Record<string, string>;

const walk = (node: JsonSchema, path: string, guide: SchemaGuide): void => {
  const properties = (node.properties ?? {}) as Record<string, JsonSchema>;
  for (const [key, child] of Object.entries(properties)) {
    const childPath = path ? `${path}.${key}` : key;
    guide[childPath] = (child.description as string | undefined) ?? '';
    walk(child, childPath, guide);
  }
  if (typeof node.additionalProperties === 'object')
    walk(node.additionalProperties as JsonSchema, `${path}.*`, guide);
  if (typeof node.items === 'object') walk(node.items as JsonSchema, `${path}[]`, guide);
};

export const schemaGuide = (schema: z.ZodType): SchemaGuide => {
  const guide: SchemaGuide = {};
  walk(toJsonSchema(schema, 'output'), '', guide);
  return guide;
};
