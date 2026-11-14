/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { createRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import {
  ARTIFACT_CREATE_IMMUTABLE_FIELDS,
  artifactCreateBodySchema,
  artifactReadResponseSchema,
} from '#/modules/artifact/schemas/artifactSchemas';
import { Modules } from '#/modules/modules';

export const organizationCreateArtifactRoute = createRoute({
  model: Modules.organization,
  submodel: Modules.artifact,
  middleware: [validatePermission('operate')],
  description:
    'Creates an artifact of a plain kind (no content table). Inside a container it inherits by default.',
  bodySchema: artifactCreateBodySchema,
  responseSchema: artifactReadResponseSchema,
  sanitizeKeys: ARTIFACT_CREATE_IMMUTABLE_FIELDS,
});
