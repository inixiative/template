/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { registerFactory } from '@template/db/test/factory';

const resourceBindingFactory = registerFactory('ResourceBinding', {
  defaults: () => ({
    bindingType: 'logo',
  }),
  dependencies: {
    sourceArtifact: {
      modelName: 'Artifact',
      foreignKey: { id: 'sourceArtifactId' },
      required: false,
    },
    resourceOrganization: {
      modelName: 'Organization',
      foreignKey: { id: 'resourceOrganizationId' },
      required: false,
    },
    resourceSpace: {
      modelName: 'Space',
      foreignKey: { id: 'resourceSpaceId' },
      required: false,
    },
    resourceUser: {
      modelName: 'User',
      foreignKey: { id: 'resourceUserId' },
      required: false,
    },
    resourceCustomerRelationship: {
      modelName: 'CustomerRelationship',
      foreignKey: { id: 'resourceCustomerRelationshipId' },
      required: false,
    },
  },
});

export const buildResourceBinding = resourceBindingFactory.build;
export const createResourceBinding = resourceBindingFactory.create;
