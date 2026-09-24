/**
 * @atlas
 * @kind type
 * @partOf primitive:appEvents
 * @uses feature:email, primitive:shared
 */
import type { WSQueryEvent } from '@template/shared/ws';
import type { ValidatedStreamAppend } from '#/appEvents/validatedStreamAppend';

export type AppEventActor = {
  actorUserId: string | null;
  actorSpoofUserId: string | null;
  actorTokenId: string | null;
  actorJobName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  sourceInquiryId: string | null;
  integrationId: string | null;
};

export type AppEventPayload<T = Record<string, unknown>> = {
  id: string;
  name: string;
  actor: AppEventActor;
  data: T;
};

export type EmailHandoff = {
  template: string;
  data: Record<string, unknown>;
};

export type WSMessageHandoff = {
  target: { channels: string[] } | { userIds: string[] };
  message: { data: WSQueryEvent };
};

export type WSStreamAppendHandoff = {
  target: { stream: string; userIds?: string[] };
  append: ValidatedStreamAppend;
};

export type WSHandoff = WSMessageHandoff | WSStreamAppendHandoff;

export type ObserveAdapter = {
  record: (event: AppEventPayload) => Promise<void>;
};

export type AppEventHandlerDefinition<T = unknown> = {
  email?: (data: T) => EmailHandoff[] | null;
  websocket?: (data: T) => WSHandoff[] | null;

  cb?: Array<(data: T) => Promise<void> | void>;
};
