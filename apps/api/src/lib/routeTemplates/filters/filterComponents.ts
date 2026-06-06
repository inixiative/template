import { z } from '@hono/zod-openapi';
import type { FieldMapEntry } from '@inixiative/json-rules';
import { JSON_FIELD_OPERATORS } from '@template/shared/bracketQuery';
import type { FieldDef } from '#/lib/prisma/fieldMetadata';
import { getValidOperators } from '#/lib/prisma/scalarOperators';

const ARRAY_OPS = new Set(['in', 'notIn']);

// `{ contains?: …, in?: […], … }` for a set of operators over a value schema.
// strict so an unsupported operator is rejected (→ additionalProperties:false in the spec).
const operatorObject = (operators: readonly string[], value: z.ZodTypeAny): z.ZodObject<z.ZodRawShape> =>
  z
    .object(Object.fromEntries(operators.map((op) => [op, (ARRAY_OPS.has(op) ? z.array(value) : value).optional()])))
    .strict();

// Open-ended JSON filter — its own shared $ref. `path` is string|string[] to cover
// both providers (MySQL string, Postgres array); server translates per provider.
export const jsonFilterSchema = z
  .object({
    path: z.union([z.string(), z.array(z.string())]).optional(),
    ...Object.fromEntries(JSON_FIELD_OPERATORS.map((op) => [op, z.string().optional()])),
  })
  .strict()
  .openapi('JsonFilter');

// One shared `<Type>Filter` $ref per scalar type, operators sourced from the same
// getValidOperators the server validates with (so the schema can never advertise an
// operator the server rejects). Built once for the fixed scalar set.
const SCALAR_TYPES = ['String', 'Int', 'BigInt', 'Float', 'Decimal', 'DateTime', 'Boolean'] as const;
const SCALAR_FILTERS = new Map<string, z.ZodObject<z.ZodRawShape>>(
  SCALAR_TYPES.flatMap((type) => {
    const operators = getValidOperators({ kind: 'scalar', type } as FieldDef);
    return operators.length ? [[type, operatorObject(operators, z.string()).openapi(`${type}Filter`)]] : [];
  }),
);

// Enums are inlined (not a shared $ref): their value set is the lens-narrowed list,
// which varies per route, so a single named component can't represent them.
const enumFilterSchema = (values: readonly string[]): z.ZodType => {
  const value = values.length ? z.enum(values as [string, ...string[]]) : z.string();
  return operatorObject(getValidOperators({ kind: 'enum', type: 'Enum' } as FieldDef), value);
};

// The filter schema for a single leaf field, or undefined when the field isn't
// filterable (e.g. a type the server allows no operators on).
export const leafFilterSchema = (entry: FieldMapEntry): z.ZodType | undefined => {
  if (entry.kind === 'enum') return enumFilterSchema(entry.values ?? []);
  if (entry.kind !== 'scalar') return undefined;
  if (entry.type === 'Json') return jsonFilterSchema;
  return SCALAR_FILTERS.get(entry.type);
};
