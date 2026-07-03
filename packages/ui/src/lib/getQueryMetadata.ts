/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import openApiSpec from '@template/sdk/openapi.gen.json';

export type EnumFilter = {
  field: string;
  values: string[];
  operators: ['in', 'notIn'];
};

export type QueryMetadata = {
  searchableFields?: string[];
  orderableFields?: string[];
  enumFilters?: EnumFilter[];
};

// biome-ignore lint/suspicious/noExplicitAny: dynamic JSON traversal of untyped OpenAPI spec
type Schema = any;

const RELATION_KEYS = new Set(['some', 'every', 'none']);
// A json leaf's keys are exactly the json operators — distinguishes it from a
// to-one relation (whose keys are field names) without descending into it.
const JSON_LEAF_KEYS = new Set(['path', 'equals', 'not', 'string_contains', 'string_starts_with', 'string_ends_with']);

export const resolveRef = (schema: Schema): Schema => {
  if (!schema?.$ref) return schema;
  let resolved: Schema = openApiSpec;
  for (const part of schema.$ref.replace('#/', '').split('/')) resolved = resolved?.[part];
  return resolved;
};

// A scalar/enum leaf is a `bare value | <Type>Filter` union (anyOf). A json leaf is a
// plain object keyed by json operators. A relation is an object keyed by field names.
const isJsonLeaf = (schema: Schema): boolean => {
  const props = schema?.properties;
  return !!props && Object.keys(props).every((k) => JSON_LEAF_KEYS.has(k));
};

// Enum leaves carry a bare `{ enum: [...] }` arm (the clean narrowed set); fall back to
// the operator arm's `in.items.enum` / `equals.enum` (stripping equals' trailing null).
const enumValuesOf = (leaf: Schema): string[] | undefined => {
  // Not a castArray: the array branch resolves refs, the fallback is the leaf itself.
  const fallback: Schema[] = [leaf];
  const arms: Schema[] = Array.isArray(leaf.anyOf) ? leaf.anyOf.map(resolveRef) : fallback;
  const bareEnum = arms.find((a) => Array.isArray(a?.enum));
  if (bareEnum) return bareEnum.enum;
  const op = arms.find((a) => a?.properties);
  const fromIn = op?.properties?.in?.items?.enum;
  if (Array.isArray(fromIn)) return fromIn;
  const fromEquals = op?.properties?.equals?.enum;
  return Array.isArray(fromEquals) ? fromEquals.filter((v): v is string => v !== null) : undefined;
};

// Flatten the nested `searchFields` schema → flat dotted paths + enum filters.
const walkSearchFields = (schema: Schema, prefix: string, out: { searchable: string[]; enums: EnumFilter[] }): void => {
  const props = resolveRef(schema)?.properties;
  if (!props) return;

  for (const [key, raw] of Object.entries<Schema>(props)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const child = resolveRef(raw);

    // scalar/enum leaf (bare | operator union)
    if (Array.isArray(child?.anyOf)) {
      out.searchable.push(path);
      const values = enumValuesOf(child);
      if (values) out.enums.push({ field: path, values, operators: ['in', 'notIn'] });
      continue;
    }

    const childProps = child?.properties;
    if (!childProps) continue;
    // to-many relations nest under some/every/none (identical shape) — descend `some`.
    if (Object.keys(childProps).some((k) => RELATION_KEYS.has(k))) {
      walkSearchFields(childProps.some, path, out);
    } else if (isJsonLeaf(child)) {
      out.searchable.push(path);
    } else {
      walkSearchFields(child, path, out);
    }
  }
};

// orderBy is an enum (or array) of `<field>:asc|desc` — strip direction to unique fields.
const extractOrderableFields = (schema: Schema): string[] => {
  const resolved = resolveRef(schema);
  for (const variant of resolved?.anyOf ?? [resolved]) {
    const values: string[] | undefined = variant?.enum ?? variant?.items?.enum;
    if (Array.isArray(values)) return [...new Set(values.map((v) => v.split(':')[0]))];
  }
  return [];
};

export const getQueryMetadata = (path: string, method: string = 'get'): QueryMetadata => {
  const spec = openApiSpec as Schema;
  const operation = spec.paths?.[path]?.[method.toLowerCase()];
  if (!operation) return {};

  const params: Schema[] = operation.parameters ?? [];
  const searchFields = params.find((p) => p.name === 'searchFields');
  const orderBy = params.find((p) => p.name === 'orderBy');

  const out = { searchable: [] as string[], enums: [] as EnumFilter[] };
  if (searchFields?.schema) walkSearchFields(searchFields.schema, '', out);

  return {
    searchableFields: out.searchable,
    orderableFields: orderBy?.schema ? extractOrderableFields(orderBy.schema) : [],
    enumFilters: out.enums,
  };
};

export const getQueryMetadataByOperation = (operationId: string): QueryMetadata => {
  const spec = openApiSpec as Schema;
  for (const [path, pathItem] of Object.entries<Schema>(spec.paths ?? {})) {
    for (const [method, operation] of Object.entries<Schema>(pathItem)) {
      if (operation?.operationId === operationId) return getQueryMetadata(path, method);
    }
  }
  return {};
};

export const useQueryMetadata = (operationId: string): QueryMetadata => getQueryMetadataByOperation(operationId);
