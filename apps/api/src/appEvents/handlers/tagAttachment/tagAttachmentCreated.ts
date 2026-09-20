/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses feature:segment, primitive:jobs
 */
import type { TagAttachment } from '@template/db/generated/client/client';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { reconcileCustomerOf } from '#/modules/segment/lib/reconcileCustomer';

export type TagAttachmentCreatedPayload = { tagAttachment: TagAttachment };

export const tagAttachmentCreated = makeAppEvent<TagAttachmentCreatedPayload>({
  cb: [({ tagAttachment }) => reconcileCustomerOf({ model: 'TagAttachment', axis: 'resourceModel' }, tagAttachment)],
});
