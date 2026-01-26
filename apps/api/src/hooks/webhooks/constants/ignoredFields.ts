/**
 * Fields to ignore when determining if an update is meaningful.
 * Used by both webhook and cache hooks to skip no-op updates.
 *
 * _global applies to all models.
 */
export const IGNORED_TRACKING_FIELDS: Record<string, string[]> = {
  _global: ['updatedAt'],
  Token: ['lastUsedAt'],
  User: ['lastLoginAt'],
};
