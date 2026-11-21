/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { registerFactory } from '@template/db/test/factory';

const settingFactory = registerFactory('Setting', {
  defaults: () => ({
    key: 'notifications.topics',
    valueJson: ['inquiries'],
  }),
  dependencies: {
    user: {
      modelName: 'User',
      foreignKey: { id: 'resourceUserId' },
      required: false,
    },
    organization: {
      modelName: 'Organization',
      foreignKey: { id: 'resourceOrganizationId' },
      required: false,
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
  },
});

export const buildSetting = settingFactory.build;
export const createSetting = settingFactory.create;
