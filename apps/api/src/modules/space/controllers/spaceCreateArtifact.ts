/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { creatorGrantFor } from '#/modules/artifact/lib/creatorGrant';
import { createArtifact } from '#/modules/artifact/services/artifactPlacements';
import { spaceCreateArtifactRoute } from '#/modules/space/routes/spaceCreateArtifact';

export const spaceCreateArtifactController = makeController(
  spaceCreateArtifactRoute,
  async (c, respond) => {
    const space = contextResource<'space'>(c);
    const owner = {
      ownerModel: 'Space' as const,
      organizationId: space.organizationId,
      spaceId: space.id,
    };
    const artifact = await createArtifact(c.get('permix'), {
      ...c.req.valid('json'),
      ...owner,
      creatorGrant: creatorGrantFor(c, owner),
    });
    return respond.created(artifact);
  },
);
