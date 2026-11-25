/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { createArtifact } from '#/modules/artifact/services/createArtifact';
import { organizationCreateArtifactRoute } from '#/modules/organization/routes/organizationCreateArtifact';

export const organizationCreateArtifactController = makeController(
  organizationCreateArtifactRoute,
  async (c, respond) => {
    const artifact = await createArtifact(c.get('permix'), {
      ...c.req.valid('json'),
      ownerModel: 'Organization',
      organizationId: contextResource<'organization'>(c).id,
    });
    return respond.created(artifact);
  },
);
