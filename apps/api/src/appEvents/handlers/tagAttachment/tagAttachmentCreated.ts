/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses feature:segment, primitive:jobs
 */
import type { TagAttachment } from '@template/db/generated/client/client';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import {
  customerReferenceOfRow,
  enqueueSegmentReconcileForCustomers,
} from '#/modules/segment/lib/enqueueSegmentReconcileForCustomers';

export type TagAttachmentCreatedPayload = { tagAttachment: TagAttachment };

export const tagAttachmentCreated = makeAppEvent<TagAttachmentCreatedPayload>({
  cb: [
    ({ tagAttachment }) =>
      enqueueSegmentReconcileForCustomers([
        customerReferenceOfRow({ model: 'TagAttachment', axis: 'resourceModel' }, tagAttachment),
      ]),
  ],
});
