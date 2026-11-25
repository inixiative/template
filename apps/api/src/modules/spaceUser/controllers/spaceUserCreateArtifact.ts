/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { createArtifact } from '#/modules/artifact/services/createArtifact';
import { spaceUserCreateArtifactRoute } from '#/modules/spaceUser/routes/spaceUserCreateArtifact';

export const spaceUserCreateArtifactController = makeController(
  spaceUserCreateArtifactRoute,
  async (c, respond) => {
    const member = contextResource<'spaceUser'>(c);
    const artifact = await createArtifact(c.get('permix'), {
      ...c.req.valid('json'),
      ownerModel: 'SpaceUser',
      organizationId: member.organizationId,
      spaceId: member.spaceId,
      userId: member.userId,
    });
    return respond.created(artifact);
  },
);
