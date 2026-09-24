/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses feature:email
 */
import { makeJob } from '#/jobs/makeJob';
import { type DeliverEmailPayload, deliverEmailMessage } from '#/lib/email/deliverEmailMessage';

export type { DeliverEmailPayload };

export const deliverEmail = makeJob<DeliverEmailPayload>(async (_ctx, payload) => deliverEmailMessage(payload));
