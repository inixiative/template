/**
 * @atlas
 * @kind schema
 * @partOf feature:integrations
 */
import { z } from '@hono/zod-openapi';
import {
  IntegrationResourceScalarInputSchema,
  IntegrationResourceScalarSchema,
} from '@template/db';
import { IntegrationResourceStatus } from '@template/db/generated/client/enums';
import { uuidV7Schema } from '@template/shared/utils';

export const integrationResourceCreateBodySchema = IntegrationResourceScalarInputSchema.omit({
  integrationId: true,
  status: true,
}).extend({
  name: z.string().trim().min(1).max(120),
  kind: z.string().min(1).max(80),
  externalId: z
    .string()
    .min(1)
    .max(250)
    .openapi({ description: "The provider's identifier for the resource." }),
  metadata: IntegrationResourceScalarInputSchema.shape.metadata.default({}),
  status: z.literal(IntegrationResourceStatus.tracked).optional().openapi({
    description:
      'Registering a removed resource that was untracked brings it back only when this says `tracked`, and only for a person.',
  }),
  projectId: uuidV7Schema.optional().openapi({
    description:
      'A Project to link the resource to. Needs `manage` on the project and `operate` on the resource.',
  }),
});

export const integrationResourceReadResponseSchema = IntegrationResourceScalarSchema;
