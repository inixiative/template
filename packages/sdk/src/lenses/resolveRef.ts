/**
 * @atlas
 * @kind helper
 * @partOf primitive:sdk
 * @uses none
 */
import openApiSpec from '@template/sdk/openapi.gen.json';

/** Resolve a `$ref` node against the spec's components; non-ref nodes pass through. */
export const resolveRef = <T extends { readonly $ref?: string }>(schema: T | undefined): T | undefined => {
  if (!schema?.$ref) return schema;
  let resolved: unknown = openApiSpec;
  for (const part of schema.$ref.replace('#/', '').split('/'))
    resolved = (resolved as Record<string, unknown> | undefined)?.[part];
  return resolved as T | undefined;
};
