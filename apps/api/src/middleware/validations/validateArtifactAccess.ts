/**
 * @atlas
 * @kind middleware
 * @partOf feature:files
 * @uses primitive:authz
 */
import type { StandardAction } from '@template/permissions/client';
import { makeMiddleware } from '#/lib/utils/makeMiddleware';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { assertArtifactAction } from '#/modules/artifact/lib/assertArtifactAction';
import { checkArtifactAccess } from '#/modules/artifact/services/checkArtifactAccess';

export const validateArtifactAccess = makeMiddleware<StandardAction>(
  (action) => async (c, next) => {
    const resource = c.get('resource') as { id: string; artifactId?: string } | null;
    if (!resource) return next();
    const artifactId = c.get('resourceType') === 'artifact' ? resource.id : resource.artifactId;
    if (!artifactId) return next();

    const verdicts = await checkArtifactAccess(artifactActorFromContext(c), [artifactId], action);
    assertArtifactAction(verdicts.get(artifactId), action);
    await next();
  },
);
