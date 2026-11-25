/**
 * @atlas
 * @kind controller
 * @partOf feature:files, feature:tenancy
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { paginateOwnerArtifacts } from '#/modules/artifact/services/paginateOwnerArtifacts';
import { spaceUserReadManyArtifactsRoute } from '#/modules/spaceUser/routes/spaceUserReadManyArtifacts';

export const spaceUserReadManyArtifactsController = makeController(
  spaceUserReadManyArtifactsRoute,
  async (c, respond) => {
    const member = contextResource<'spaceUser'>(c);
    const { data, pagination } = await paginateOwnerArtifacts(
      c,
      {
        ownerModel: 'SpaceUser',
        organizationId: member.organizationId,
        spaceId: member.spaceId,
        userId: member.userId,
      },
      { allReadable: true },
    );
    return respond.ok(data, { pagination });
  },
);
