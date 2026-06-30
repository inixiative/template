/**
 * @atlas
 * @kind type
 * @partOf primitive:appEvents
 * @uses feature:email, primitive:shared
 */
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

// Generic websocket envelope: target a set of channels OR a set of users, with an
// arbitrary message payload. A declarative query-refetch (WSEvent) is just one kind
// of `message.data` — the producer computes the channel(s) (e.g. channelKey(queryKey))
// and wraps the event. Broader than refetch-only: also serves user-targeted pushes,
// presence, toasts, etc.
export type WSHandoff = {
  target: { channels: string[] } | { userIds: string[] };
  message: { data: Record<string, unknown> };
};

export type ObserveData = Record<string, unknown>;

export type ObserveAdapter = {
  record: (event: AppEventPayload, data: ObserveData) => Promise<void>;
};

export type AppEventHandlerDefinition<T = unknown> = {
  email?: (data: T) => EmailHandoff[] | null;
  websocket?: (data: T) => WSHandoff[] | null;
  observe?: (data: T) => ObserveData | null;

  cb?: Array<(data: T) => Promise<void> | void>;
};
