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

// Generic websocket envelope: target a set of channels, users OR data streams, with an
// arbitrary message payload. A declarative query-refetch (WSEvent) is just one kind
// of `message.data` — the producer computes the channel(s) (e.g. channelKey(queryKey))
// and wraps the event. For a streams target, `message.data` is the append payload; the
// transport wraps it in the stream's data frame.
export type WSHandoff = {
  target: { channels: string[] } | { userIds: string[] } | { streams: string[] };
  message: { data: Record<string, unknown> };
};

export type ObserveAdapter = {
  record: (event: AppEventPayload) => Promise<void>;
};

export type AppEventHandlerDefinition<T = unknown> = {
  email?: (data: T) => EmailHandoff[] | null;
  websocket?: (data: T) => WSHandoff[] | null;

  cb?: Array<(data: T) => Promise<void> | void>;
};
