import type { Contact } from '@template/db/generated/client/client';
import type { CommunicationKind, ContactType } from '@template/db/generated/client/enums';
import { makeBroadcastRegistry } from '@template/shared/adapter';

export type MessageContent = {
  text?: string;       // may contain {{recipient.*}}, {{data.*}}, {{sender.*}}
  html?: string;       // same — interpolated by messageUser/messageContact before dispatch
  mediaUrls?: string[];
  /**
   * Caller-provided template variables. Available as `{{data.*}}` in
   * `text` / `html`. The interpolation engine also injects `recipient`
   * (and, for email-side calls, `sender`) automatically.
   */
  data?: Record<string, unknown>;
};

export type MessageDispatchOptions = {
  /**
   * Internal ChatMessage id to thread / reply against. Adapter maps to
   * provider-native ref (Slack thread_ts, Discord message_reference,
   * WhatsApp context.message_id) by looking up the original outbound send
   * for this provider. Only set by messageContact — broadcasts can't
   * thread.
   */
  replyTo?: { chatMessageId: string };
};

/**
 * Adapter signature shared by every messaging provider (whatsapp, signal,
 * sms, discord, slack, telegram, teams, …). The adapter owns:
 *  - reading the recipient handle out of `contact.value` / `contact.valueKey`
 *  - converting canonical `{ text, html, mediaUrls }` into the provider's
 *    bespoke payload (Slack blocks, Discord embeds, WhatsApp text-vs-template,
 *    etc.) — callers never speak provider-native
 *  - resolving `replyTo.chatMessageId` to the provider-native reply ref
 *    when the message was previously sent on this provider
 *  - enqueuing the right `send<Provider>` job
 *
 * Adapters are registered by `Contact.type`. messageUser / messageContact
 * look up the adapter; missing adapter is a hard error.
 */
export type MessageProviderAdapter = (
  contact: Contact,
  content: MessageContent,
  kind: CommunicationKind,
  options: MessageDispatchOptions,
) => Promise<void>;

export const messageProviderRegistry = makeBroadcastRegistry<MessageProviderAdapter>();

export const getMessageProviderAdapter = (type: ContactType): MessageProviderAdapter | undefined =>
  messageProviderRegistry.has(type) ? messageProviderRegistry.get(type) : undefined;
