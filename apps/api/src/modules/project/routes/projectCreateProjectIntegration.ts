/**
 * @atlas
 * @kind route
 * @partOf feature:project
 * @uses primitive:routeTemplates, primitive:authz
 */
import { z } from '@hono/zod-openapi';
import { ProjectIntegrationScalarSchema } from '@template/db';
import { uuidV7Schema } from '@template/shared/utils';
import { createRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const projectCreateProjectIntegrationBodySchema = z.object({
  integrationId: uuidV7Schema,
});

export const projectCreateProjectIntegrationRoute = createRoute({
  model: Modules.project,
  submodel: Modules.projectIntegration,
  bodySchema: projectCreateProjectIntegrationBodySchema,
  responseSchema: ProjectIntegrationScalarSchema,
  description: 'Links an existing Integration to this Project within the same tenant boundary.',
});
