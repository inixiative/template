/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 */
import { TagResource } from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const tagAttachmentFactory = createFactory('TagAttachment', {
  defaults: () => ({
    resourceModel: TagResource.User,
  }),
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
  },
});

export const buildTagAttachment = tagAttachmentFactory.build;
export const createTagAttachment = tagAttachmentFactory.create;
