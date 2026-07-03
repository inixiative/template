/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui
 * @uses none
 */
import { createLens, type FieldMap, type FieldMapEntry, type Lens } from '@inixiative/json-rules';
import type { SdkSchema } from '@template/ui/lib/lenses/sdkSchema';

const MAP_NAME = 'sdk';

const primaryType = (schema: SdkSchema): string | undefined => {
  const t = schema.type;
  if (Array.isArray(t)) return t.find((x) => x !== 'null');
  return t as string | undefined;
};

const scalarType = (schema: SdkSchema): string => {
  switch (primaryType(schema)) {
    case 'string':
      return schema.format === 'date-time' ? 'DateTime' : 'String';
    case 'integer':
      return 'Int';
    case 'number':
      return 'Float';
    case 'boolean':
      return 'Boolean';
    default:
      return 'Json';
  }
};

const hasProperties = (schema: SdkSchema): boolean =>
  schema.properties !== undefined && Object.keys(schema.properties).length > 0;

const buildModel = (schema: SdkSchema, modelName: string, models: FieldMap['models']): void => {
  const fields: Record<string, FieldMapEntry> = {};

  for (const [field, prop] of Object.entries(schema.properties ?? {})) {
    const isList = primaryType(prop) === 'array' && prop.items !== undefined;
    const target = isList ? (prop.items as SdkSchema) : prop;
    const enumValues = target.enum?.filter((v): v is string => typeof v === 'string');

    if (enumValues?.length) {
      fields[field] = {
        kind: 'enum',
        type: `${modelName}.${field}`,
        values: enumValues,
        ...(isList ? { isList } : {}),
      };
    } else if (primaryType(target) === 'object' && hasProperties(target)) {
      const childName = `${modelName}.${field}`;
      buildModel(target, childName, models);
      fields[field] = { kind: 'object', type: childName, ...(isList ? { isList } : {}) };
    } else {
      fields[field] = { kind: 'scalar', type: scalarType(target), ...(isList ? { isList } : {}) };
    }
  }

  models[modelName] = { fields };
};

/**
 * Build a json-rules lens from an SDK response schema. The response schema IS the
 * filter vocabulary — anything the endpoint returns is in memory and filterable,
 * including computed fields the server can't `WHERE`. `name` is the endpoint view's
 * identity (the spec component name, e.g. `InquiryReceivedItem`), NOT a Prisma model:
 * two endpoints share a vocabulary iff they share a response component. Prefer
 * `lensFromOperation(operationId)`, which resolves schema + name from the spec.
 * Field kinds drive the builder surface (operators, options, coercion stamping);
 * narrow with the standard `LensNarrowing` shape.
 */
export const lensFromSchema = (schema: SdkSchema, name: string): Lens => {
  const root = primaryType(schema) === 'array' && schema.items ? schema.items : schema;

  const models: FieldMap['models'] = {};
  buildModel(root, name, models);

  if (Object.keys(models[name]?.fields ?? {}).length === 0)
    throw new Error(`lensFromSchema: '${name}' has no fields — not a model response schema`);

  return createLens({ maps: { [MAP_NAME]: { models } }, mapName: MAP_NAME, model: name });
};
