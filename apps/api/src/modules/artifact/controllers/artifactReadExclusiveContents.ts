/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { artifactReadExclusiveContentsRoute } from '#/modules/artifact/routes/artifactReadExclusiveContents';
import { checkArtifactAccess } from '#/modules/artifact/services/checkArtifactAccess';
import { listExclusiveContents } from '#/modules/artifact/services/listExclusiveContents';

export const artifactReadExclusiveContentsController = makeController(
  artifactReadExclusiveContentsRoute,
  async (c, respond) => {
    const contents = await listExclusiveContents(getResource<'artifact'>(c).id);
    const verdicts = await checkArtifactAccess(
      artifactActorFromContext(c),
      contents.map((artifact) => artifact.id),
      'read',
    );
    return respond.ok(contents.filter((artifact) => verdicts.get(artifact.id)?.listed));
  },
);
