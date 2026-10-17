/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses infrastructure:prisma, feature:email
 */
import type { Condition } from '@inixiative/json-rules';
import type { CommunicationKind } from '@template/db/generated/client/enums';
import { EmailRenderError } from '@template/email/errors/EmailRenderError';
import { OPAQUE_SLOT } from '@template/email/rules';
import { makeJob } from '#/jobs/makeJob';
import { emailLensFor } from '#/lib/email/emailLensFor';
import { recipientVariables, renderForRecipient } from '#/lib/email/renderForRecipient';
import type { Sender } from '#/lib/email/sender';
import { ownerScope } from '#/lib/emailTemplate';
import { canDeliver } from '#/lib/messaging/canDeliver';
import { getMessageProviderAdapter, type MessageContent } from '#/lib/messaging/providers';
import { resolveUsers } from '#/lib/messaging/resolveUsers';
import { targetedBySender } from '#/lib/messaging/senderTargeting';

export type MessageUserPayload = {
  rule: Condition;
  kind: CommunicationKind;
  content: MessageContent;
  sender?: Sender;
};

const isRecipientGone = (error: unknown): boolean =>
  error instanceof EmailRenderError && error.type === 'recipient_missing';

export const messageUser = makeJob<MessageUserPayload>(async (_ctx, payload) => {
  const { rule, kind, content, sender = { type: 'platform' } } = payload;
  const lens = emailLensFor(undefined, ownerScope(sender), undefined, sender);
  if (!lens.recipient || lens.recipient === OPAQUE_SLOT)
    throw new Error('messageUser: the recipient lens is not a model lens');
  const users = await resolveUsers(targetedBySender(rule, lens.recipient, sender), lens.recipient);

  for (const user of users) {
    const variables = await recipientVariables(lens, {
      recipientId: user.id,
      sender,
      data: content.data,
    }).catch((error: unknown) => {
      if (isRecipientGone(error)) return null;
      throw error;
    });
    if (!variables) continue;
    const rendered: MessageContent = {
      ...content,
      text: content.text ? renderForRecipient(content.text, variables, lens) : undefined,
      html: content.html ? renderForRecipient(content.html, variables, lens) : undefined,
    };

    for (const contact of user.contacts) {
      if (!canDeliver(kind, contact)) continue;

      const adapter = getMessageProviderAdapter(contact.type);
      if (!adapter) throw new Error(`No message provider adapter for contact.type=${contact.type}`);

      await adapter(contact, rendered, kind, {});
    }
  }
});
