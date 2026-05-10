import type { Condition } from '@inixiative/json-rules';
import type { CommunicationKind } from '@template/db/generated/client/enums';
import { makeJob } from '#/jobs/makeJob';
import { canDeliver } from '#/lib/messaging/canDeliver';
import { interpolateContent } from '#/lib/messaging/interpolateContent';
import { getMessageProviderAdapter, type MessageContent } from '#/lib/messaging/providers';
import { resolveUsers } from '#/lib/messaging/resolveUsers';

export type MessageUserPayload = {
  rule: Condition;
  kind: CommunicationKind;
  content: MessageContent;
};

/**
 * Broadcast a message to every user matching the rule, fanned across each
 * user's accepted contacts (per-Contact `acceptedKinds`). Each contact is
 * dispatched via its provider adapter. Missing provider adapter is a hard
 * error — the system has a contact of a type it doesn't know how to send to.
 *
 * `content.text` / `content.html` are interpolated per-recipient with
 * `{{recipient.*}}` and `{{data.*}}` (same engine as email templates).
 *
 * No replyTo: a broadcast doesn't have a single conversation to thread into.
 * For in-conversation replies use messageContact.
 */
export const messageUser = makeJob<MessageUserPayload>(async (_ctx, payload) => {
  const { rule, kind, content } = payload;

  const users = await resolveUsers(rule);

  for (const user of users) {
    const rendered = interpolateContent(content, {
      recipient: user as unknown as Record<string, unknown>,
      data: content.data,
    });

    for (const contact of user.contacts) {
      if (!canDeliver(kind, contact)) continue;

      const adapter = getMessageProviderAdapter(contact.type);
      if (!adapter) throw new Error(`No message provider adapter for contact.type=${contact.type}`);

      await adapter(contact, rendered, kind, {});
    }
  }
});
