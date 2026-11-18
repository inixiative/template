/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses feature:segment, primitive:jobs
 */
import type { Tag, TagAttachment } from '@template/db/generated/client/client';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import {
  customerReferenceOfRow,
  enqueueSegmentReconcileForCustomers,
} from '#/modules/segment/lib/enqueueSegmentReconcileForCustomers';

export type TagDeletedPayload = { tag: Tag; tagAttachments: TagAttachment[] };

export const tagDeleted = makeAppEvent<TagDeletedPayload>({
  cb: [
    ({ tagAttachments }) =>
      enqueueSegmentReconcileForCustomers(
        tagAttachments.map((attachment) =>
          customerReferenceOfRow({ model: 'TagAttachment', axis: 'resourceModel' }, attachment),
        ),
      ),
  ],
});
