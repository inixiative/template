/**
 * @atlas
 * @kind type
 * @partOf primitive:appEvents
 * @uses feature:email, primitive:shared
 */
import type { WSEvent } from '@template/shared/ws';

export type AppEventActor = {
  actorUserId: string | null;
  actorSpoofUserId: string | null;
  actorTokenId: string | null;
  actorJobName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  sourceInquiryId: string | null;
};

export type AppEventPayload<T = Record<string, unknown>> = {
  name: string;
  actor: AppEventActor;
  data: T;
  timestamp: string;
};

export type EmailHandoff = {
  template: string;
  data: Record<string, unknown>;
};

export type ObserveData = Record<string, unknown>;

export type ObserveAdapter = {
  record: (event: AppEventPayload, data: ObserveData) => Promise<void>;
};

export type AppEventHandlerDefinition<T = unknown> = {
  email?: (data: T) => EmailHandoff[] | null;
  websocket?: (data: T) => WSEvent[] | null;
  observe?: (data: T) => ObserveData | null;

  cb?: Array<(data: T) => Promise<void> | void>;
};
