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

const resolveRef = (schema: Schema): Schema => {
  if (!schema?.$ref) return schema;
  let resolved: Schema = openApiSpec;
  for (const part of schema.$ref.replace('#/', '').split('/')) resolved = resolved?.[part];
  return resolved;
};

// A leaf filter's property values are terminal value-schemas (operator → string/array/
// enum); a relation node's property values are themselves filters ($ref or nested object).
// Classifying by value (not key name) avoids misreading a field literally named like an
// operator (e.g. a `path` column) as a leaf.
const isValueSchema = (schema: Schema): boolean => !!schema && !schema.$ref && !schema.properties;
const isLeafFilter = (schema: Schema): boolean => {
  const props = schema?.properties;
  return !!props && Object.values(props).every((value) => isValueSchema(value));
};

// `equals.enum` carries a trailing null (equals is nullable); `in.items.enum` is the clean set.
const enumValuesOf = (leaf: Schema): string[] | undefined => {
  const fromIn = leaf.properties?.in?.items?.enum;
  if (Array.isArray(fromIn)) return fromIn;
  const fromEquals = leaf.properties?.equals?.enum;
  return Array.isArray(fromEquals) ? fromEquals.filter((v: unknown) => v !== null) : undefined;
};

// Flatten the nested `searchFields` schema → flat dotted paths + enum filters.
const walkSearchFields = (schema: Schema, prefix: string, out: { searchable: string[]; enums: EnumFilter[] }): void => {
  const props = resolveRef(schema)?.properties;
  if (!props) return;

  for (const [key, raw] of Object.entries<Schema>(props)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const child = resolveRef(raw);

    if (isLeafFilter(child)) {
      out.searchable.push(path);
      const values = enumValuesOf(child);
      if (values) out.enums.push({ field: path, values, operators: ['in', 'notIn'] });
      continue;
    }

    const childProps = child?.properties ?? {};
    // to-many relations nest under some/every/none (identical shape) — descend `some`.
    if (Object.keys(childProps).some((k) => RELATION_KEYS.has(k))) {
      walkSearchFields(childProps.some, path, out);
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
