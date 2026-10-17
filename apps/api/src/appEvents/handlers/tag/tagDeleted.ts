/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses feature:segment, primitive:jobs
 */
import type { Tag, TagAttachment } from '@template/db/generated/client/client';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { reconcileCustomerOf } from '#/modules/segment/lib/reconcileCustomer';

export type TagDeletedPayload = { tag: Tag; tagAttachments: TagAttachment[] };

export const tagDeleted = makeAppEvent<TagDeletedPayload>({
  cb: [
    async ({ tagAttachments }) => {
      for (const attachment of tagAttachments) {
        await reconcileCustomerOf({ model: 'TagAttachment', axis: 'resourceModel' }, attachment);
      }
    },
  ],
});
