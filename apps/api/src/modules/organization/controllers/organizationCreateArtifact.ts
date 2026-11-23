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
import { organizationCreateArtifactRoute } from '#/modules/organization/routes/organizationCreateArtifact';

export const organizationCreateArtifactController = makeController(
  organizationCreateArtifactRoute,
  async (c, respond) => {
    const owner = {
      ownerModel: 'Organization' as const,
      organizationId: contextResource<'organization'>(c).id,
    };
    const artifact = await createArtifact(c.get('permix'), {
      ...c.req.valid('json'),
      ...owner,
      creatorGrant: creatorGrantFor(c, owner),
    });
    return respond.created(artifact);
  },
);
