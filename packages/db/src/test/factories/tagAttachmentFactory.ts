/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { createFactory } from '@template/db/test/factory';

const tagAttachmentFactory = createFactory('TagAttachment', {
  defaults: () => ({}),
  dependencies: {
    user: {
      modelName: 'User',
      foreignKey: { id: 'userId' },
      required: false,
    },
    organization: {
      modelName: 'Organization',
      foreignKey: { id: 'organizationId' },
      required: false,
    },
    space: {
      modelName: 'Space',
      foreignKey: { id: 'spaceId' },
      required: false,
    },
    project: {
      modelName: 'Project',
      foreignKey: { id: 'projectId' },
      required: false,
    },
  },
});

export const buildTagAttachment = tagAttachmentFactory.build;
export const createTagAttachment = tagAttachmentFactory.create;
