/**
 * @atlas
 * @kind route
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { actionRoute } from '#/lib/routeTemplates';
import {
  artifactMoveBodySchema,
  artifactReadResponseSchema,
} from '#/modules/artifact/schemas/artifactSchemas';
import { Modules } from '#/modules/modules';

export const artifactMoveRoute = actionRoute({
  model: Modules.artifact,
  action: 'move',
  description:
    "Moves an artifact: replaces one placement with another in one step. Omit sourceContainerArtifactId to move it from its owner's root; omit targetContainerArtifactId to move it to the root. Same-owner edges need manage on the artifact and operate on the target container; cross-owner edges need read on create and operate on the target container.",
  bodySchema: artifactMoveBodySchema,
  responseSchema: artifactReadResponseSchema,
});
