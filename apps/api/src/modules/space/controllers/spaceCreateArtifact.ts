/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { createArtifact } from '#/modules/artifact/services/createArtifact';
import { spaceCreateArtifactRoute } from '#/modules/space/routes/spaceCreateArtifact';

export const spaceCreateArtifactController = makeController(
  spaceCreateArtifactRoute,
  async (c, respond) => {
    const space = getResource<'space'>(c);
    const user = c.get('user');
    const spaceUser = user
      ? (c.get('spaceUsers') ?? []).find((membership) => membership.spaceId === space.id)
      : undefined;
    const artifact = await createArtifact(artifactActorFromContext(c), {
      ...c.req.valid('json'),
      ownerModel: 'Space',
      spaceId: space.id,
      creatorGrant: spaceUser
        ? {
            granteeModel: 'SpaceUser',
            granteeOrganizationId: spaceUser.organizationId,
            granteeSpaceId: space.id,
            granteeUserId: spaceUser.userId,
          }
        : undefined,
    });
    return respond.created(artifact);
  },
);
