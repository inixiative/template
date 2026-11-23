/**
 * @atlas
 * @kind middleware
 * @partOf feature:files
 * @uses primitive:authz
 */
import type { StandardAction } from '@template/permissions/client';
import type { Context } from 'hono';
import { makeMiddleware } from '#/lib/utils/makeMiddleware';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { assertArtifactAction } from '#/modules/artifact/lib/assertArtifactAction';
import {
  type ArtifactAccessVerdict,
  checkArtifactAccess,
} from '#/modules/artifact/services/checkArtifactAccess';
import type { AppEnv } from '#/types/appEnv';

const verdictByContext = new WeakMap<Context<AppEnv>, ArtifactAccessVerdict>();

export const artifactAccessVerdict = (c: Context<AppEnv>): ArtifactAccessVerdict | undefined =>
  verdictByContext.get(c);

export const validateArtifactAccess = makeMiddleware<StandardAction>(
  (action) => async (c, next) => {
    const resource = c.get('resource') as { id: string; artifactId?: string } | null;
    if (!resource) {
      throw new Error('validateArtifactAccess requires a loaded resource on context');
    }
    const artifactId = c.get('resourceType') === 'artifact' ? resource.id : resource.artifactId;
    if (!artifactId) {
      throw new Error('validateArtifactAccess requires an artifact or artifactId on the resource');
    }

    const verdicts = await checkArtifactAccess(artifactActorFromContext(c), [artifactId], action);
    const verdict = verdicts.get(artifactId);
    assertArtifactAction(verdict, action);
    if (verdict) verdictByContext.set(c, verdict);
    await next();
  },
);
