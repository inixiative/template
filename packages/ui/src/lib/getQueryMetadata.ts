import openApiSpec from '@template/ui/openapi.json';

export type EnumFilter = {
  field: string;
  values: string[];
  operators: ['in', 'notin'];
};

export type QueryMetadata = {
  searchableFields?: string[];
  orderableFields?: string[];
  enumFilters?: EnumFilter[];
};

/**
 * Extract orderable fields from schema recursively.
 * Excludes arrays, includes nested objects with dot notation.
 */
const extractOrderableFields = (schema: any, prefix: string = '', visited: Set<any> = new Set()): string[] => {
  if (!schema || typeof schema !== 'object' || visited.has(schema)) {
    return [];
  }

  visited.add(schema);

  const fields: string[] = [];
  const properties = schema.properties || {};

  for (const [key, prop] of Object.entries(properties)) {
    const propSchema = prop as any;
    const fieldPath = prefix ? `${prefix}.${key}` : key;

    if (propSchema.type === 'array') {
      continue;
    }

    if (propSchema.type === 'object' && propSchema.properties) {
      fields.push(...extractOrderableFields(propSchema, fieldPath, visited));
    } else {
      fields.push(fieldPath);
    }
  }

  return fields;
};

/**
 * Extract enum filters from schema recursively.
 */
const extractEnumFilters = (schema: any, prefix: string = '', visited: Set<any> = new Set()): EnumFilter[] => {
  if (!schema || typeof schema !== 'object' || visited.has(schema)) {
    return [];
  }

  visited.add(schema);

  const filters: EnumFilter[] = [];
  const properties = schema.properties || {};

  for (const [key, prop] of Object.entries(properties)) {
    const propSchema = prop as any;
    const fieldPath = prefix ? `${prefix}.${key}` : key;

    if (propSchema.enum && Array.isArray(propSchema.enum)) {
      filters.push({
        field: fieldPath,
        values: propSchema.enum,
        operators: ['in', 'notin'],
      });
    }

    if (propSchema.type === 'object' && propSchema.properties) {
      filters.push(...extractEnumFilters(propSchema, fieldPath, visited));
    }
  }

  return filters;
};

/**
 * Get response schema for an operation.
 */
const getResponseSchema = (operation: any): any => {
  const response200 = operation.responses?.['200'];
  if (!response200) return null;

  const content = response200.content?.['application/json'];
  if (!content?.schema) return null;

  let schema = content.schema;

  // Handle { data: T } wrapper
  if (schema.properties?.data) {
    schema = schema.properties.data;
  }

  // Handle arrays
  if (schema.type === 'array' && schema.items) {
    schema = schema.items;
  }

  // Resolve $ref
  if (schema.$ref) {
    const refPath = schema.$ref.replace('#/', '').split('/');
    let resolved: any = openApiSpec;
    for (const part of refPath) {
      resolved = resolved[part];
      if (!resolved) return null;
    }
    schema = resolved;
  }

  return schema;
};

/**
 * Extract query metadata from OpenAPI spec for a given endpoint.
 *
 * @example
 * const meta = getQueryMetadata('/api/admin/organization', 'get');
 * // => {
 * //   searchableFields: ['name', 'slug'],
 * //   orderableFields: ['id', 'name', 'slug', 'createdAt', ...],
 * //   enumFilters: [{ field: 'status', values: [...], operators: [...] }]
 * // }
 */
export const getQueryMetadata = (path: string, method: string = 'get'): QueryMetadata => {
  const spec = openApiSpec as any;
  const operation = spec.paths?.[path]?.[method.toLowerCase()];

  if (!operation) {
    return {};
  }

  const responseSchema = getResponseSchema(operation);

  return {
    searchableFields: operation['x-searchable-fields'] || [],
    orderableFields: responseSchema ? extractOrderableFields(responseSchema) : [],
    enumFilters: responseSchema ? extractEnumFilters(responseSchema) : [],
  };
};

/**
 * Get query metadata by operation ID.
 *
 * @example
 * const meta = getQueryMetadataByOperation('adminOrganizationReadMany');
 * // => { searchableFields: ['name', 'slug'], orderableFields: [...], ... }
 */
export const getQueryMetadataByOperation = (operationId: string): QueryMetadata => {
  const spec = openApiSpec as any;

  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem as any)) {
      const op = operation as any;
      if (op.operationId === operationId) {
        return getQueryMetadata(path, method);
      }
    }
  }

  return {};
};

/**
 * Hook to get query metadata for a given operation.
 *
 * @example
 * function OrganizationTable() {
 *   const meta = useQueryMetadata('adminOrganizationReadMany');
 *
 *   return (
 *     <DataTable
 *       searchableFields={meta.searchableFields}
 *       orderableFields={meta.orderableFields}
 *       enumFilters={meta.enumFilters}
 *     />
 *   );
 * }
 */
export const useQueryMetadata = (operationId: string): QueryMetadata => {
  return getQueryMetadataByOperation(operationId);
};
