import type { EmailComponent, EmailTemplate, EmailOwnerModel } from '@template/db';

export type SaveContext = {
  ownerModel: EmailOwnerModel;
  organizationId?: string | null;
  spaceId?: string | null;
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
