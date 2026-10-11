/**
 * @atlas
 * @kind helper
 * @partOf primitive:flows
 * @uses primitive:sdk
 */
import type { LensNarrowing, ModelNarrowing } from '@inixiative/json-rules';
import { lensFromSchema } from '@template/sdk/lenses/lensFromSchema';
import type { SdkSchema } from '@template/sdk/lenses/sdkSchema';
import { z } from 'zod';

type JsonSchemaNode = {
  type?: string | string[];
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode;
};

const isType = (node: JsonSchemaNode, type: string) =>
  Array.isArray(node.type) ? node.type.includes(type) : node.type === type;

const everyRelation = (node: JsonSchemaNode): ModelNarrowing => {
  const relations: Record<string, ModelNarrowing> = {};
  for (const [field, prop] of Object.entries(node.properties ?? {})) {
    const target = isType(prop, 'array') && prop.items ? prop.items : prop;
    if (isType(target, 'object') && Object.keys(target.properties ?? {}).length)
      relations[field] = everyRelation(target);
  }
  return Object.keys(relations).length ? { relations } : {};
};

export const responseLens = (responseSchema: z.ZodType, name: string): LensNarrowing => {
  const schema = z.toJSONSchema(responseSchema, {
    io: 'output',
    unrepresentable: 'any',
  }) as JsonSchemaNode;
  return { parent: lensFromSchema(schema as SdkSchema, name), root: everyRelation(schema) };
};
