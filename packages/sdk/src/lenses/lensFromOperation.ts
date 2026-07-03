/**
 * @atlas
 * @kind helper
 * @partOf primitive:sdk
 * @uses none
 */
import type { Lens } from '@inixiative/json-rules';
import { lensFromSchema } from '@template/sdk/lenses/lensFromSchema';
import { resolveRef } from '@template/sdk/lenses/resolveRef';
import type { SdkSchema } from '@template/sdk/lenses/sdkSchema';
import openApiSpec from '@template/sdk/openapi.gen.json';

// The slice of the spec this traversal reads: an SdkSchema node that may instead be a $ref.
type SpecNode = SdkSchema & {
  readonly $ref?: string;
  readonly properties?: { readonly [key: string]: SpecNode };
  readonly items?: SpecNode;
};

type SpecOperation = {
  readonly operationId?: string;
  readonly responses?: {
    readonly [status: string]: {
      readonly content?: { readonly [mime: string]: { readonly schema?: SpecNode } };
    };
  };
};

/**
 * Build the filter lens for an endpoint from the OpenAPI spec: operationId → 200
 * response → `data` envelope (array → items). The lens is endpoint-derived and
 * self-naming — the response component name when the item is a `$ref`
 * (`meReceivedManyInquiries` → `InquiryReceivedItem`), the operationId otherwise —
 * so endpoints share a vocabulary exactly when they share a response shape.
 */
export const lensFromOperation = (operationId: string): Lens => {
  const paths = (openApiSpec as { paths?: Record<string, Record<string, SpecOperation>> }).paths;
  for (const pathItem of Object.values(paths ?? {})) {
    for (const operation of Object.values(pathItem)) {
      if (operation?.operationId !== operationId) continue;
      const response: SpecNode | undefined = resolveRef(
        operation.responses?.['200']?.content?.['application/json']?.schema,
      );
      const data = response?.properties?.data;
      const item = data?.type === 'array' ? data.items : data;
      if (!item) throw new Error(`lensFromOperation: '${operationId}' has no data envelope to lens`);
      const name = item.$ref?.split('/').pop() ?? operationId;
      return lensFromSchema(resolveRef(item) as SdkSchema, name);
    }
  }
  throw new Error(`lensFromOperation: unknown operationId '${operationId}'`);
};
