/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { Lens } from '@inixiative/json-rules';
import openApiSpec from '@template/sdk/openapi.gen.json';
import { resolveRef } from '@template/ui/lib/getQueryMetadata';
import { lensFromSchema, type SdkSchema } from '@template/ui/lib/lensFromSchema';

// biome-ignore lint/suspicious/noExplicitAny: dynamic JSON traversal of untyped OpenAPI spec
type Schema = any;

const refName = (schema: Schema): string | undefined =>
  typeof schema?.$ref === 'string' ? schema.$ref.split('/').pop() : undefined;

/**
 * Build the filter lens for an endpoint from the OpenAPI spec: operationId → 200
 * response → `data` envelope (array → items). The lens is endpoint-derived and
 * self-naming — the response component name when the item is a `$ref`
 * (`meReceivedManyInquiries` → `InquiryReceivedItem`), the operationId otherwise —
 * so endpoints share a vocabulary exactly when they share a response shape.
 */
export const lensFromOperation = (operationId: string): Lens => {
  const spec = openApiSpec as Schema;
  for (const pathItem of Object.values<Schema>(spec.paths ?? {})) {
    for (const operation of Object.values<Schema>(pathItem)) {
      if (operation?.operationId !== operationId) continue;
      const response = operation.responses?.['200']?.content?.['application/json']?.schema;
      const data = resolveRef(response)?.properties?.data;
      if (!data) throw new Error(`lensFromOperation: '${operationId}' has no data envelope to lens`);
      const item = data.type === 'array' ? data.items : data;
      const name = refName(item) ?? operationId;
      return lensFromSchema(resolveRef(item) as SdkSchema, name);
    }
  }
  throw new Error(`lensFromOperation: unknown operationId '${operationId}'`);
};
