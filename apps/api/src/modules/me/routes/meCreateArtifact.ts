/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { createRoute } from '#/lib/routeTemplates';

import {
  ARTIFACT_CREATE_IMMUTABLE_FIELDS,
  artifactCreateBodySchema,
  artifactReadResponseSchema,
} from '#/modules/artifact/schemas/artifactSchemas';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const meCreateArtifactRoute = createRoute({
  model: Modules.me,
  submodel: Modules.artifact,
  skipId: true,
  description:
    'Creates an artifact of a plain kind (no content table). Inside a container it inherits by default.',
  bodySchema: artifactCreateBodySchema,
  responseSchema: artifactReadResponseSchema,
  sanitizeKeys: ARTIFACT_CREATE_IMMUTABLE_FIELDS,
  tags: [Tags.me, Tags.artifact],
});
