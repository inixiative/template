/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui
 * @uses primitive:sdk
 */

import { resolveRef } from '@template/sdk/lenses/resolveRef';
import type { SdkSchema } from '@template/sdk/lenses/sdkSchema';
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

type SpecNode = SdkSchema & {
  readonly $ref?: string;
  readonly anyOf?: readonly SpecNode[];
  readonly properties?: { readonly [key: string]: SpecNode };
  readonly items?: SpecNode;
};

type SpecParameter = { readonly name?: string; readonly schema?: SpecNode };

type SpecOperation = {
  readonly operationId?: string;
  readonly parameters?: readonly SpecParameter[];
};

type Spec = {
  readonly paths?: { readonly [path: string]: { readonly [method: string]: SpecOperation } };
};

const spec = openApiSpec as Spec;

const stringValues = (values: SdkSchema['enum']): string[] | undefined =>
  values?.filter((v): v is string => typeof v === 'string');

const RELATION_KEYS = new Set(['some', 'every', 'none']);
// A json leaf's keys are exactly the json operators — distinguishes it from a
// to-one relation (whose keys are field names) without descending into it.
const JSON_LEAF_KEYS = new Set([
  'path',
  'equals',
  'not',
  'string_contains',
  'string_starts_with',
  'string_ends_with',
]);

// A scalar/enum leaf is a `bare value | <Type>Filter` union (anyOf). A json leaf is a
// plain object keyed by json operators. A relation is an object keyed by field names.
const isJsonLeaf = (schema: SpecNode): boolean => {
  const props = schema?.properties;
  return !!props && Object.keys(props).every((k) => JSON_LEAF_KEYS.has(k));
};

// Enum leaves carry a bare `{ enum: [...] }` arm (the clean narrowed set); fall back to
// the operator arm's `in.items.enum` / `equals.enum` (stripping equals' trailing null).
const enumValuesOf = (leaf: SpecNode): string[] | undefined => {
  // Not a castArray: the array branch resolves refs, the fallback is the leaf itself.
  const fallback: (SpecNode | undefined)[] = [leaf];
  const arms = leaf.anyOf ? leaf.anyOf.map(resolveRef) : fallback;
  const bareEnum = arms.find((a) => Array.isArray(a?.enum));
  if (bareEnum) return stringValues(bareEnum.enum);
  const op = arms.find((a) => a?.properties);
  const fromIn = op?.properties?.in?.items?.enum;
  if (Array.isArray(fromIn)) return stringValues(fromIn);
  return stringValues(op?.properties?.equals?.enum);
};

// Flatten the nested `searchFields` schema → flat dotted paths + enum filters.
const walkSearchFields = (
  schema: SpecNode | undefined,
  prefix: string,
  out: { searchable: string[]; enums: EnumFilter[] },
): void => {
  const props = resolveRef(schema)?.properties;
  if (!props) return;

  for (const [key, raw] of Object.entries(props)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const child = resolveRef(raw);

    // scalar/enum leaf (bare | operator union)
    if (child?.anyOf) {
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
const extractOrderableFields = (schema: SpecNode): string[] => {
  const resolved = resolveRef(schema);
  for (const variant of resolved?.anyOf ?? [resolved]) {
    const values = stringValues(variant?.enum ?? variant?.items?.enum);
    if (values) return [...new Set(values.map((v) => v.split(':')[0]))];
  }
  return [];
};

export const getQueryMetadata = (path: string, method: string = 'get'): QueryMetadata => {
  const operation = spec.paths?.[path]?.[method.toLowerCase()];
  if (!operation) return {};

  const params = operation.parameters ?? [];
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
  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (operation?.operationId === operationId) return getQueryMetadata(path, method);
    }
  }
  return {};
};

export const useQueryMetadata = (operationId: string): QueryMetadata =>
  getQueryMetadataByOperation(operationId);
