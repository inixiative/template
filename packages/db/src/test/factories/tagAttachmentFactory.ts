import { TagResource } from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const tagAttachmentFactory = createFactory('TagAttachment', {
  defaults: () => ({
    resourceModel: TagResource.User,
  }),
});

export const buildTagAttachment = tagAttachmentFactory.build;
export const createTagAttachment = tagAttachmentFactory.create;
