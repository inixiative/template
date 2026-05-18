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
const extractOrderableFields = (schema: any, prefix: string = '', visited: Set<any> = new Set()): string[] => {
  if (!schema || typeof schema !== 'object' || visited.has(schema)) {
    return [];
  }

  visited.add(schema);

  const fields: string[] = [];
  const properties = schema.properties || {};

  for (const [key, prop] of Object.entries(properties)) {
    // biome-ignore lint/suspicious/noExplicitAny: dynamic JSON traversal of untyped OpenAPI spec
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

// biome-ignore lint/suspicious/noExplicitAny: dynamic JSON traversal of untyped OpenAPI spec
const extractEnumFilters = (schema: any, prefix: string = '', visited: Set<any> = new Set()): EnumFilter[] => {
  if (!schema || typeof schema !== 'object' || visited.has(schema)) {
    return [];
  }

  visited.add(schema);

  const filters: EnumFilter[] = [];
  const properties = schema.properties || {};

  for (const [key, prop] of Object.entries(properties)) {
    // biome-ignore lint/suspicious/noExplicitAny: dynamic JSON traversal of untyped OpenAPI spec
    const propSchema = prop as any;
    const fieldPath = prefix ? `${prefix}.${key}` : key;

    if (propSchema.enum && Array.isArray(propSchema.enum)) {
      filters.push({
        field: fieldPath,
        values: propSchema.enum,
        operators: ['in', 'notIn'],
      });
    }

    if (propSchema.type === 'object' && propSchema.properties) {
      filters.push(...extractEnumFilters(propSchema, fieldPath, visited));
    }
  }

  return filters;
};

// biome-ignore lint/suspicious/noExplicitAny: dynamic JSON traversal of untyped OpenAPI spec
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
    // biome-ignore lint/suspicious/noExplicitAny: dynamic JSON traversal of untyped OpenAPI spec
    let resolved: any = openApiSpec;
    for (const part of refPath) {
      resolved = resolved[part];
      if (!resolved) return null;
    }
    schema = resolved;
  }

  return schema;
};

export const getQueryMetadata = (path: string, method: string = 'get'): QueryMetadata => {
  // biome-ignore lint/suspicious/noExplicitAny: dynamic JSON traversal of untyped OpenAPI spec
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

export const getQueryMetadataByOperation = (operationId: string): QueryMetadata => {
  // biome-ignore lint/suspicious/noExplicitAny: dynamic JSON traversal of untyped OpenAPI spec
  const spec = openApiSpec as any;

  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    // biome-ignore lint/suspicious/noExplicitAny: dynamic JSON traversal of untyped OpenAPI spec
    for (const [method, operation] of Object.entries(pathItem as any)) {
      // biome-ignore lint/suspicious/noExplicitAny: dynamic JSON traversal of untyped OpenAPI spec
      const op = operation as any;
      if (op.operationId === operationId) {
        return getQueryMetadata(path, method);
      }
    }
  }

  return {};
};

export const useQueryMetadata = (operationId: string): QueryMetadata => {
  return getQueryMetadataByOperation(operationId);
};
