/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { readRoute } from '#/lib/routeTemplates';

import { artifactReadResponseSchema } from '#/modules/artifact/schemas/artifactSchemas';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';

export const meReadManyArtifactsRoute = readRoute({
  model: Modules.me,
  submodel: Modules.artifact,
  many: true,
  skipId: true,
  description:
    "Lists the owner's root artifacts (those in no container) that the caller can read: the top of the browser.",
  responseSchema: artifactReadResponseSchema,
  tags: [OpenApiTags.me, OpenApiTags.artifact],
});
