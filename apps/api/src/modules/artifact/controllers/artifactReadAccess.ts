/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import {
  artifactEffectiveRole,
  hydrateArtifact,
  isArtifactPublic,
} from '#/modules/artifact/lib/checkArtifactPermission';
import { artifactReadAccessRoute } from '#/modules/artifact/routes/artifactReadAccess';

export const artifactReadAccessController = makeController(
  artifactReadAccessRoute,
  async (c, respond) => {
    const hydrated = await hydrateArtifact(contextResource<'artifact'>(c));
    return respond.ok({
      role: artifactEffectiveRole(c.get('permix'), hydrated),
      public: isArtifactPublic(hydrated),
    });
  },
);
