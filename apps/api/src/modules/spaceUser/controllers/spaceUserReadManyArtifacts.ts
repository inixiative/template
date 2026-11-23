/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { fetchRootArtifacts } from '#/modules/artifact/services/fetchRootArtifacts';
import { spaceUserReadManyArtifactsRoute } from '#/modules/spaceUser/routes/spaceUserReadManyArtifacts';

export const spaceUserReadManyArtifactsController = makeController(
  spaceUserReadManyArtifactsRoute,
  async (c, respond) => {
    const member = contextResource<'spaceUser'>(c);
    const roots = await fetchRootArtifacts(c.get('permix'), {
      ownerModel: 'SpaceUser',
      organizationId: member.organizationId,
      spaceId: member.spaceId,
      userId: member.userId,
    });
    return respond.ok(roots);
  },
);
