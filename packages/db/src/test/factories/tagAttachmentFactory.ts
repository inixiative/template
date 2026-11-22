/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { registerFactory } from '@template/db/test/factory';

const tagAttachmentFactory = registerFactory('TagAttachment', {
  defaults: () => ({}),
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
    space: {
      modelName: 'Space',
      foreignKey: { id: 'resourceSpaceId' },
      required: false,
    },
    project: {
      modelName: 'Project',
      foreignKey: { id: 'resourceProjectId' },
      required: false,
    },
  },
});

export const buildTagAttachment = tagAttachmentFactory.build;
export const createTagAttachment = tagAttachmentFactory.create;
