/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { CommunicationKind } from '@template/db/generated/client/enums';
import { makeJob } from '#/jobs/makeJob';
import { canDeliver } from '#/lib/messaging/canDeliver';
import { getMessageProviderAdapter, type MessageContent, type MessageDispatchOptions } from '#/lib/messaging/providers';

export type MessageContactPayload = {
  contactId: string;
  kind: CommunicationKind;
  content: MessageContent;
  replyTo?: MessageDispatchOptions['replyTo'];
};

export const messageContact = makeJob<MessageContactPayload>(async (_ctx, payload) => {
  const { contactId, kind, content, replyTo } = payload;

  const contact = await db.contact.findFirstOrThrow({
    where: { id: contactId, deletedAt: null },
  });

  if (!canDeliver(kind, contact)) return;

  const adapter = getMessageProviderAdapter(contact.type);
  if (!adapter) throw new Error(`No message provider adapter for contact.type=${contact.type}`);

  await adapter(contact, content, kind, { replyTo });
});
