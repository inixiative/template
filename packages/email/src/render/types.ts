/**
 * @atlas
 * @kind type
 * @partOf feature:email
 * @uses none
 */
import type { EmailComponent, EmailOwnerModel, EmailTemplate } from '@template/db/generated/client/client';

export type OwnerScope = {
  ownerModel: EmailOwnerModel;
  organizationId?: string | null;
  spaceId?: string | null;
  // Carried from the Sender so the cascade is a pure transform (no DB round-trip to
  // resolve a space's org). userId is carried for user-owned-template lookup.
  userId?: string | null;
  locale: string;
};

export const EmailModels = {
  EmailComponent: 'EmailComponent',
  EmailTemplate: 'EmailTemplate',
} as const;

export type EmailModel = keyof typeof EmailModels;

export type EmailModelType = {
  EmailComponent: EmailComponent;
  EmailTemplate: EmailTemplate;
};
