import type { CommunicationCategory } from '@template/db';

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
  resourceType?: string;
  resourceId?: string;
  data: T;
  timestamp: string;
};

export type AppEventHandler = (event: AppEventPayload) => Promise<void> | void;

export type AppEventOptions = {
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

export type ResolvedRecipient = {
  to: string;
  name: string;
};

export type EmailTarget =
  | { userIds: string[] }
  | { raw: string[] }
  | { orgRole: { organizationId: string; role: string } }
  | { spaceRole: { spaceId: string; role: string } };

export type EmailHandoff = {
  target: EmailTarget | EmailTarget[];
  group?: {
    to: EmailTarget | EmailTarget[];
    cc?: EmailTarget | EmailTarget[];
    bcc?: EmailTarget | EmailTarget[];
  };
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

export type AppEventHandlerDefinition<T = unknown> = {
  email?: (data: T) => EmailHandoff[] | null;
  websocket?: (data: T) => WSHandoff[] | null;
  on?: Array<(data: T) => Promise<void> | void>;
};
