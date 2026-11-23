/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactAccessVerdict } from '#/middleware/validations/validateArtifactAccess';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { artifactReadAccessRoute } from '#/modules/artifact/routes/artifactReadAccess';
import { checkArtifactAccess } from '#/modules/artifact/services/checkArtifactAccess';

export const artifactReadAccessController = makeController(
  artifactReadAccessRoute,
  async (c, respond) => {
    const artifact = contextResource<'artifact'>(c);
    const verdict =
      artifactAccessVerdict(c, artifact.id) ??
      (await checkArtifactAccess(artifactActorFromContext(c), [artifact.id], 'read')).get(
        artifact.id,
      )!;
    return respond.ok({ role: verdict.role, public: verdict.public });
  },
);
