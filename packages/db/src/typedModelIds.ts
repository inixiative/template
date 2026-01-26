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

  // Inquiries
  Inquiry: 'Inquiry',

  // Webhooks
  WebhookSubscription: 'WebhookSubscription',
  WebhookEvent: 'WebhookEvent',

  // Jobs
  CronJob: 'CronJob',
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

// Inquiries
export type InquiryId = Id<typeof ModelIdType.Inquiry>;

// Webhooks
export type WebhookSubscriptionId = Id<typeof ModelIdType.WebhookSubscription>;
export type WebhookEventId = Id<typeof ModelIdType.WebhookEvent>;

// Jobs
export type CronJobId = Id<typeof ModelIdType.CronJob>;

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

// Inquiries
export const inquiryId = (id: string): InquiryId => id as InquiryId;

// Webhooks
export const webhookSubscriptionId = (id: string): WebhookSubscriptionId => id as WebhookSubscriptionId;
export const webhookEventId = (id: string): WebhookEventId => id as WebhookEventId;

// Jobs
export const cronJobId = (id: string): CronJobId => id as CronJobId;
