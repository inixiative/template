/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { artifactReadAncestorsRoute } from '#/modules/artifact/routes/artifactReadAncestors';
import { fetchArtifactAncestors } from '#/modules/artifact/services/fetchArtifactAncestors';

export const artifactReadAncestorsController = makeController(
  artifactReadAncestorsRoute,
  async (c, respond) =>
    respond.ok(
      await fetchArtifactAncestors(artifactActorFromContext(c), contextResource<'artifact'>(c).id),
    ),
);
