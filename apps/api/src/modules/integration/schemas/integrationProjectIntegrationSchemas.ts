/**
 * @atlas
 * @kind schema
 * @partOf feature:integrations, feature:project
 */
import { z } from '@hono/zod-openapi';
import {
  ProjectIntegrationResourceScalarSchema,
  ProjectIntegrationScalarSchema,
  ProjectScalarSchema,
} from '@template/db';
import { uuidV7Schema } from '@template/shared/utils';
import { sanitizeRequestSchema } from '#/lib/routeTemplates/utils/sanitizeRequestSchema';
import { projectCreateBodySchema } from '#/modules/project/schemas/projectSchemas';

export const integrationCreateProjectIntegrationResourceItemSchema = z.object({
  integrationResourceId: uuidV7Schema,
  isIdentity: z.boolean().optional(),
});

export const integrationCreateProjectIntegrationItemSchema = z.object({
  projectId: uuidV7Schema.optional(),
  project: sanitizeRequestSchema(projectCreateBodySchema).optional(),
  resources: z.array(integrationCreateProjectIntegrationResourceItemSchema).max(200).optional(),
});

export type IntegrationCreateProjectIntegrationItem = z.infer<
  typeof integrationCreateProjectIntegrationItemSchema
>;

export const integrationProjectIntegrationResponseSchema = ProjectIntegrationScalarSchema.extend({
  project: ProjectScalarSchema,
  projectIntegrationResources: z.array(ProjectIntegrationResourceScalarSchema),
});
