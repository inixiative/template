/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { createArtifact } from '#/modules/artifact/services/placeArtifact';
import { organizationCreateArtifactRoute } from '#/modules/organization/routes/organizationCreateArtifact';

export const organizationCreateArtifactController = makeController(
  organizationCreateArtifactRoute,
  async (c, respond) => {
    const organization = getResource<'organization'>(c);
    const user = c.get('user');
    const member = user
      ? (c.get('organizationUsers') ?? []).find(
          (membership) => membership.organizationId === organization.id,
        )
      : undefined;
    const artifact = await createArtifact(artifactActorFromContext(c), {
      ...c.req.valid('json'),
      ownerModel: 'Organization',
      organizationId: organization.id,
      creatorGrant: member
        ? {
            granteeModel: 'OrganizationUser',
            granteeOrganizationId: organization.id,
            granteeUserId: member.userId,
          }
        : undefined,
    });
    return respond.created(artifact);
  },
);
