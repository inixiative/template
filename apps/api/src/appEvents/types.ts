/**
 * @atlas
 * @kind type
 * @partOf primitive:appEvents
 * @uses feature:email, primitive:shared
 */
import type { EmailTarget, ResolvedRecipient } from '@template/email/targeting';
import type { WSEvent } from '@template/shared/ws';

export type { EmailTarget, ResolvedRecipient };

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

export type EmailSenderContext = {
  ownerModel: 'default' | 'Organization' | 'Space' | 'User';
  organizationId?: string;
  spaceId?: string;
  userId?: string;
};

export type EmailHandoff = {
  to: EmailTarget[];
  cc?: EmailTarget[];
  bcc?: EmailTarget[];
  template: string;
  data: Record<string, unknown>;
  sender?: EmailSenderContext;
  tags?: string[];
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
