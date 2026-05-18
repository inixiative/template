import type { Contact } from '@template/db/generated/client/client';
import type { CommunicationKind, ContactType } from '@template/db/generated/client/enums';
import { makeBroadcastRegistry } from '@template/shared/adapter';

export type MessageContent = {
  text?: string; // may contain {{recipient.*}}, {{data.*}}, {{sender.*}}
  html?: string; // same — interpolated by messageUser/messageContact before dispatch
  mediaUrls?: string[];
  data?: Record<string, unknown>;
};

export type MessageDispatchOptions = {
  replyTo?: { chatMessageId: string };
};

export type MessageProviderAdapter = (
  contact: Contact,
  content: MessageContent,
  kind: CommunicationKind,
  options: MessageDispatchOptions,
) => Promise<void>;

export const messageProviderRegistry = makeBroadcastRegistry<MessageProviderAdapter>();

export const getMessageProviderAdapter = (type: ContactType): MessageProviderAdapter | undefined =>
  messageProviderRegistry.has(type) ? messageProviderRegistry.get(type) : undefined;
