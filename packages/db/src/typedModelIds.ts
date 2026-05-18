// Phantom type brand for model IDs
export type Id<Model> = string & { readonly __model: Model };

// Model type markers (used only for type discrimination)
export const ModelIdType = {
  // Users & Auth
  User: 'User',
  Account: 'Account',
  Session: 'Session',
  Verification: 'Verification',
  Token: 'Token',

  // Organizations
  Organization: 'Organization',
  OrganizationUser: 'OrganizationUser',

  // Spaces
  Space: 'Space',
  SpaceUser: 'SpaceUser',

  // Customers
  CustomerRef: 'CustomerRef',

  // Contacts
  Contact: 'Contact',

  // Inquiries
  Inquiry: 'Inquiry',

  // Email
  EmailTemplate: 'EmailTemplate',
  EmailComponent: 'EmailComponent',

  // Webhooks
  WebhookSubscription: 'WebhookSubscription',
  WebhookEvent: 'WebhookEvent',

  // Jobs
  CronJob: 'CronJob',

  // Auth Providers
  AuthProvider: 'AuthProvider',

  // Audit
  AuditLog: 'AuditLog',

  // App Events
  AppEvent: 'AppEvent',

  // Tags
  Tag: 'Tag',
  TagCategory: 'TagCategory',
  TagAttachment: 'TagAttachment',
} as const;

// ─────────────────────────────────────────────────────────────
// Type aliases for each model's ID
// ─────────────────────────────────────────────────────────────

// Users & Auth
export type UserId = Id<typeof ModelIdType.User>;
export type AccountId = Id<typeof ModelIdType.Account>;
export type SessionId = Id<typeof ModelIdType.Session>;
export type VerificationId = Id<typeof ModelIdType.Verification>;
export type TokenId = Id<typeof ModelIdType.Token>;

// Organizations
export type OrganizationId = Id<typeof ModelIdType.Organization>;
export type OrganizationUserId = Id<typeof ModelIdType.OrganizationUser>;

// Spaces
export type SpaceId = Id<typeof ModelIdType.Space>;
export type SpaceUserId = Id<typeof ModelIdType.SpaceUser>;

// Customers
export type CustomerRefId = Id<typeof ModelIdType.CustomerRef>;

// Contacts
export type ContactId = Id<typeof ModelIdType.Contact>;

// Inquiries
export type InquiryId = Id<typeof ModelIdType.Inquiry>;

// Email
export type EmailTemplateId = Id<typeof ModelIdType.EmailTemplate>;
export type EmailComponentId = Id<typeof ModelIdType.EmailComponent>;

// Webhooks
export type WebhookSubscriptionId = Id<typeof ModelIdType.WebhookSubscription>;
export type WebhookEventId = Id<typeof ModelIdType.WebhookEvent>;

// Jobs
export type CronJobId = Id<typeof ModelIdType.CronJob>;

// Auth Providers
export type AuthProviderId = Id<typeof ModelIdType.AuthProvider>;

// Audit
export type AuditLogId = Id<typeof ModelIdType.AuditLog>;

// App Events
export type AppEventId = Id<typeof ModelIdType.AppEvent>;

// Tags
export type TagId = Id<typeof ModelIdType.Tag>;
export type TagCategoryId = Id<typeof ModelIdType.TagCategory>;
export type TagAttachmentId = Id<typeof ModelIdType.TagAttachment>;

// ─────────────────────────────────────────────────────────────
// Constructor functions (cast raw strings to typed IDs)
// ─────────────────────────────────────────────────────────────

// Users & Auth
export const userId = (id: string): UserId => id as UserId;
export const accountId = (id: string): AccountId => id as AccountId;
export const sessionId = (id: string): SessionId => id as SessionId;
export const verificationId = (id: string): VerificationId => id as VerificationId;
export const tokenId = (id: string): TokenId => id as TokenId;

// Organizations
export const organizationId = (id: string): OrganizationId => id as OrganizationId;
export const organizationUserId = (id: string): OrganizationUserId => id as OrganizationUserId;

// Spaces
export const spaceId = (id: string): SpaceId => id as SpaceId;
export const spaceUserId = (id: string): SpaceUserId => id as SpaceUserId;

// Customers
export const customerRefId = (id: string): CustomerRefId => id as CustomerRefId;

// Contacts
export const contactId = (id: string): ContactId => id as ContactId;

// Inquiries
export const inquiryId = (id: string): InquiryId => id as InquiryId;

// Email
export const emailTemplateId = (id: string): EmailTemplateId => id as EmailTemplateId;
export const emailComponentId = (id: string): EmailComponentId => id as EmailComponentId;

// Webhooks
export const webhookSubscriptionId = (id: string): WebhookSubscriptionId => id as WebhookSubscriptionId;
export const webhookEventId = (id: string): WebhookEventId => id as WebhookEventId;

// Jobs
export const cronJobId = (id: string): CronJobId => id as CronJobId;

// Auth Providers
export const authProviderId = (id: string): AuthProviderId => id as AuthProviderId;

// Audit
export const auditLogId = (id: string): AuditLogId => id as AuditLogId;

// App Events
export const appEventId = (id: string): AppEventId => id as AppEventId;

// Tags
export const tagId = (id: string): TagId => id as TagId;
export const tagCategoryId = (id: string): TagCategoryId => id as TagCategoryId;
export const tagAttachmentId = (id: string): TagAttachmentId => id as TagAttachmentId;
