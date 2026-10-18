/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { Role } from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const artifactPermissionFactory = createFactory('ArtifactPermission', {
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
    granteeCustomerRef: {
      modelName: 'CustomerRef',
      foreignKey: { id: 'granteeCustomerRefId' },
      required: false,
    },
    granteeIntegration: {
      modelName: 'Integration',
      foreignKey: { id: 'granteeIntegrationId' },
      required: false,
    },
  },
});

export const buildArtifactPermission = artifactPermissionFactory.build;
export const createArtifactPermission = artifactPermissionFactory.create;
