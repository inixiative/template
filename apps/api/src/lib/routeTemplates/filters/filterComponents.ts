/**
 * @atlas
 * @kind schema
 * @partOf primitive:routeTemplates
 * @uses primitive:shared
 */
import { z } from '@hono/zod-openapi';
import type { FieldMapEntry } from '@inixiative/json-rules';
import { JSON_FIELD_OPERATORS } from '@template/shared/bracketQuery';
import type { FieldDef } from '#/lib/prisma/fieldMetadata';
import { getValidOperators } from '#/lib/prisma/scalarOperators';

const ARRAY_OPS = new Set(['in', 'notIn']);
// Operators that accept a null symbol value (is-null / is-set). On the wire null
// arrives via the `[:]` marker; here the value is simply nullable.
const NULLABLE_OPS = new Set(['equals', 'not']);

// `{ contains?: …, in?: […], … }` for a set of operators over a value schema.
// strict so an unsupported operator is rejected (→ additionalProperties:false in the spec).
const operatorObject = (operators: readonly string[], value: z.ZodTypeAny): z.ZodObject<z.ZodRawShape> =>
  z
    .object(
      Object.fromEntries(
        operators.map((op) => {
          const opValue = ARRAY_OPS.has(op) ? z.array(value) : NULLABLE_OPS.has(op) ? value.nullable() : value;
          return [op, opValue.optional()];
        }),
      ),
    )
    .strict();

// JSON operator values: the backend buildJsonWhere accepts non-string scalars
// (null→provider json-null, booleans, numbers) in addition to strings, so the
// schema must not reject those. NULLABLE_OPS (equals/not) carry the null is-null
// symbol; string-prefix ops (string_contains/…) are string-only by nature, but
// the shared value union keeps the schema permissive in line with the server.
const JSON_VALUE = z.union([z.string(), z.boolean(), z.number(), z.null()]);

// Open-ended JSON filter — its own shared $ref. `path` is string|string[] to cover
// both providers (MySQL string, Postgres array); server translates per provider.
export const jsonFilterSchema = z
  .object({
    path: z.union([z.string(), z.array(z.string())]).optional(),
    ...Object.fromEntries(JSON_FIELD_OPERATORS.map((op) => [op, JSON_VALUE.optional()])),
  })
  .strict()
  .openapi('JsonFilter');

// One shared `<Type>Filter` $ref per scalar type, operators sourced from the same
// getValidOperators the server validates with (so the schema can never advertise an
// operator the server rejects). Built once for the fixed scalar set.
// Only types scalarOperators actually defines operators for. (BigInt/Float/Decimal
// aren't filterable server-side yet — adding them is scalarOperators + coerceValue work.)
const SCALAR_TYPES = ['String', 'Int', 'DateTime', 'Boolean'] as const;
const SCALAR_FILTERS = new Map<string, z.ZodObject<z.ZodRawShape>>(
  SCALAR_TYPES.flatMap((type) => {
    const operators = getValidOperators({ kind: 'scalar', type } as FieldDef);
    if (!operators.length) return [];
    const value = type === 'Boolean' ? z.boolean() : z.string();
    return [[type, operatorObject(operators, value).openapi(`${type}Filter`)]];
  }),
);

// Enums are inlined (not a shared $ref): their value set is the lens-narrowed list,
// which varies per route, so a single named component can't represent them.
const enumFilterSchema = (values: readonly string[]): z.ZodType => {
  const value = values.length ? z.enum(values as [string, ...string[]]) : z.string();
  return operatorObject(getValidOperators({ kind: 'enum', type: 'Enum' } as FieldDef), value);
};

// A bare value (no operator) defaults to the field's operator at runtime
// (wrapBareValue). Wire primitives are string, or null/boolean via the `[:]`
// symbol marker. Json is excluded — it always requires an explicit operator.
const BARE_VALUE = z.union([z.string(), z.boolean(), z.null()]);

// The filter schema for a single leaf field, or undefined when the field isn't
// filterable (e.g. a type the server allows no operators on). Scalars/enums accept
// either a bare value (`field=foo`) or the operator object (`field[contains]=foo`).
export const leafFilterSchema = (entry: FieldMapEntry): z.ZodType | undefined => {
  if (entry.kind === 'enum') {
    const values = entry.values ?? [];
    const bare = values.length ? z.enum(values as [string, ...string[]]) : z.string();
    return z.union([bare, enumFilterSchema(values)]);
  }
  if (entry.kind !== 'scalar') return undefined;
  if (entry.type === 'Json') return jsonFilterSchema;
  const filter = SCALAR_FILTERS.get(entry.type);
  return filter ? z.union([BARE_VALUE, filter]) : undefined;
};
