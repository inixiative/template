/**
 * Typed Model IDs
 *
 * Provides compile-time safety for model IDs using phantom types.
 * This prevents accidentally passing a UserId where a SessionId is expected.
 *
 * Usage:
 *   const user = await db.user.findUnique({ where: { id: userId('abc-123') } });
 *
 *   // This would be a compile-time error:
 *   // await db.session.findUnique({ where: { id: userId('abc-123') } });
 */

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
