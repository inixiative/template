/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { registerFactory } from '@template/db/test/factory';

const billingResourceFactory = registerFactory('BillingResource', {
  defaults: () => ({}),
  dependencies: {
    billingAccount: {
      modelName: 'BillingAccount',
      foreignKey: { id: 'billingAccountId' },
      required: true,
    },
    organizationUser: {
      modelName: 'OrganizationUser',
      foreignKey: { organizationId: 'resourceOrganizationId', userId: 'resourceUserId' },
      required: false,
    },
    space: {
      modelName: 'Space',
      foreignKey: { organizationId: 'resourceOrganizationId', id: 'resourceSpaceId' },
      required: false,
    },
    spaceUser: {
      modelName: 'SpaceUser',
      foreignKey: {
        organizationId: 'resourceOrganizationId',
        spaceId: 'resourceSpaceId',
        userId: 'resourceUserId',
      },
      required: false,
    },
    project: {
      modelName: 'Project',
      foreignKey: { id: 'resourceProjectId' },
      required: false,
    },
    projectIntegration: {
      modelName: 'ProjectIntegration',
      foreignKey: { id: 'resourceProjectIntegrationId' },
      required: false,
    },
  },
});

export const buildBillingResource = billingResourceFactory.build;
export const createBillingResource = billingResourceFactory.create;
