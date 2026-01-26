export type BaseAppEventType = 'user.signedUp' | 'user.verified' | 'user.updated';

export type AppEventType = BaseAppEventType | (string & {});

export type AppEventPayload<T = Record<string, unknown>> = {
  type: AppEventType;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  data: T;
  timestamp: string;
};

export type AppEventHandler = (event: AppEventPayload) => Promise<void> | void;

export type AppEventOptions = {
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
};
