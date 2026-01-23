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
  Session: 'Session',
  Wallet: 'Wallet',

  // Webhooks
  WebhookSubscription: 'WebhookSubscription',
  WebhookEvent: 'WebhookEvent',
} as const;

// ─────────────────────────────────────────────────────────────
// Type aliases for each model's ID
// ─────────────────────────────────────────────────────────────

// Users & Auth
export type UserId = Id<typeof ModelIdType.User>;
export type SessionId = Id<typeof ModelIdType.Session>;
export type WalletId = Id<typeof ModelIdType.Wallet>;

// Webhooks
export type WebhookSubscriptionId = Id<typeof ModelIdType.WebhookSubscription>;
export type WebhookEventId = Id<typeof ModelIdType.WebhookEvent>;

// ─────────────────────────────────────────────────────────────
// Constructor functions (cast raw strings to typed IDs)
// ─────────────────────────────────────────────────────────────

// Users & Auth
export const userId = (id: string): UserId => id as UserId;
export const sessionId = (id: string): SessionId => id as SessionId;
export const walletId = (id: string): WalletId => id as WalletId;

// Webhooks
export const webhookSubscriptionId = (id: string): WebhookSubscriptionId => id as WebhookSubscriptionId;
export const webhookEventId = (id: string): WebhookEventId => id as WebhookEventId;
