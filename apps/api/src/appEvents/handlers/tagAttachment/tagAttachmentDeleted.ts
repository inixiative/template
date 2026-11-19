/**
 * @atlas
 * @kind handler
 * @partOf primitive:appEvents
 * @uses feature:segment, primitive:jobs
 */
import type { TagAttachment } from '@template/db/generated/client/client';
import { makeAppEvent } from '#/appEvents/makeAppEvent';
import { customerSideOfRow } from '#/modules/customerRelationship/lib/customerRelationshipSides';
import { enqueueSegmentReconcileForCustomers } from '#/modules/segment/lib/enqueueSegmentReconcileForCustomers';

export type TagAttachmentDeletedPayload = { tagAttachment: TagAttachment };

export const tagAttachmentDeleted = makeAppEvent<TagAttachmentDeletedPayload>({
  cb: [
    ({ tagAttachment }) =>
      enqueueSegmentReconcileForCustomers([
        customerSideOfRow({ model: 'TagAttachment', axis: 'resourceModel' }, tagAttachment),
      ]),
  ],
});
