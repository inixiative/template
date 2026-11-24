/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { Role } from '@template/db/generated/client/enums';
import { registerFactory } from '@template/db/test/factory';

const artifactPermissionFactory = registerFactory('ArtifactPermission', {
  defaults: () => ({
    role: Role.viewer,
  }),
  dependencies: {
    artifact: { modelName: 'Artifact', foreignKey: { id: 'artifactId' } },
    granteeUser: { modelName: 'User', foreignKey: { id: 'granteeUserId' }, required: false },
    granteeOrganization: {
      modelName: 'Organization',
      foreignKey: { id: 'granteeOrganizationId' },
      required: false,
    },
    granteeSpace: { modelName: 'Space', foreignKey: { id: 'granteeSpaceId' }, required: false },
    granteeOrganizationUser: {
      modelName: 'OrganizationUser',
      foreignKey: { organizationId: 'granteeOrganizationId', userId: 'granteeUserId' },
      required: false,
    },
    granteeSpaceUser: {
      modelName: 'SpaceUser',
      foreignKey: {
        organizationId: 'granteeOrganizationId',
        spaceId: 'granteeSpaceId',
        userId: 'granteeUserId',
      },
      required: false,
    },
    granteeCustomerRelationship: {
      modelName: 'CustomerRelationship',
      foreignKey: { id: 'granteeCustomerRelationshipId' },
      required: false,
    },
  },
});

export const buildArtifactPermission = artifactPermissionFactory.build;
export const createArtifactPermission = artifactPermissionFactory.create;
