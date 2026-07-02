/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui
 * @uses none
 */
import { createLens, type FieldMap, type FieldMapEntry, type Lens } from '@inixiative/json-rules';

/** The JSON-schema shape the SDK emits in `schemas.gen.ts` (`as const`, so deep-readonly). */
export type SdkSchema = {
  readonly type?: string | readonly string[];
  readonly format?: string;
  readonly enum?: readonly (string | number | null)[];
  readonly properties?: { readonly [key: string]: SdkSchema };
  readonly items?: SdkSchema;
};

export type LensFromSchemaOptions = {
  /** Anchor model name — shows up in builder paths and lens narrowings. */
  model?: string;
};

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

const buildModel = (schema: SdkSchema, modelName: string, models: FieldMap['models']): void => {
  const fields: Record<string, FieldMapEntry> = {};

  for (const [field, prop] of Object.entries(schema.properties ?? {})) {
    const isList = primaryType(prop) === 'array' && prop.items !== undefined;
    const target = isList ? (prop.items as SdkSchema) : prop;

    if (target.enum) {
      const values = target.enum.filter((v): v is string => typeof v === 'string');
      fields[field] = {
        kind: 'enum',
        type: `${modelName}.${field}`,
        ...(isList ? { isList } : {}),
        ...(values.length ? { values } : {}),
      };
    } else if (primaryType(target) === 'object' && target.properties) {
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
 * Build a json-rules lens from an SDK response schema — the client-side twin of the
 * backend's Prisma-derived field maps. Anything the SDK returns is filterable in
 * memory, so the response schema IS the filter vocabulary: scalars keep their type
 * (date/number comparisons coerce correctly), enums carry their allowed values, and
 * nested objects/arrays become traversable relations. Narrow with the standard
 * `LensNarrowing` shape (`{ parent: lens, root: { picks: [...] } }`).
 */
export const lensFromSchema = (schema: SdkSchema, options?: LensFromSchemaOptions): Lens => {
  const model = options?.model ?? 'Item';
  const root = primaryType(schema) === 'array' && schema.items ? schema.items : schema;

  const models: FieldMap['models'] = {};
  buildModel(root, model, models);

  return createLens({ maps: { [MAP_NAME]: { models } }, mapName: MAP_NAME, model });
};
