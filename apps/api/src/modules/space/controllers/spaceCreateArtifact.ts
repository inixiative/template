/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { creatorGrantFor } from '#/modules/artifact/lib/creatorGrant';
import { createArtifact } from '#/modules/artifact/services/artifactPlacements';
import { spaceCreateArtifactRoute } from '#/modules/space/routes/spaceCreateArtifact';

export const spaceCreateArtifactController = makeController(
  spaceCreateArtifactRoute,
  async (c, respond) => {
    const owner = { ownerModel: 'Space' as const, spaceId: getResource<'space'>(c).id };
    const artifact = await createArtifact(artifactActorFromContext(c), {
      ...c.req.valid('json'),
      ...owner,
      creatorGrant: creatorGrantFor(c, owner),
    });
    return respond.created(artifact);
  },
);
