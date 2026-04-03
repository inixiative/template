import type { CommunicationCategory } from '@template/db';

export type BaseAppEventType =
  | 'user.created'
  | 'user.signedUp'
  | 'user.verified'
  | 'user.updated'
  | 'user.verificationRequested'
  | 'inquiry.sent'
  | 'inquiry.resolved'
  | 'inquiry.approved'
  | 'inquiry.denied'
  | 'inquiry.changesRequested';

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

export type EmailContext = {
  userId?: string;
  organizationId?: string;
  spaceId?: string;
};

export type EmailSenderContext = {
  ownerModel: 'default' | 'Organization' | 'Space' | 'User';
  organizationId?: string;
  spaceId?: string;
  userId?: string;
};

export type EmailHandoff = {
  target: { userIds: string[] } | { raw: string[] };
  message: { template: string; data: Record<string, unknown> };
  tags: string[];
  category: CommunicationCategory;
  from?: string;
  sender?: EmailSenderContext;
  context?: EmailContext;
};

export type WSHandoff = {
  target: { channels: string[] } | { userIds: string[] };
  message: { data: Record<string, unknown> };
};
