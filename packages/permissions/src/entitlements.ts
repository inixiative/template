/**
 * Entitlements (ABAC)
 *
 * Custom permission grants stored in the database.
 * Allows fine-grained, user-specific permissions beyond roles.
 * These get merged into permix via setupOrgContext.
 */

export type EntitlementGrant = 'allow' | 'deny';

export type Entitlements = Record<string, Record<string, EntitlementGrant>>;
