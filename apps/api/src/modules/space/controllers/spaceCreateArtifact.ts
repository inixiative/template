/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { createArtifact } from '#/modules/artifact/services/createArtifact';
import { spaceCreateArtifactRoute } from '#/modules/space/routes/spaceCreateArtifact';

export const spaceCreateArtifactController = makeController(
  spaceCreateArtifactRoute,
  async (c, respond) => {
    const space = contextResource<'space'>(c);
    const artifact = await createArtifact(c.get('permix'), {
      ...c.req.valid('json'),
      ownerModel: 'Space',
      organizationId: space.organizationId,
      spaceId: space.id,
    });
    return respond.created(artifact);
  },
);
