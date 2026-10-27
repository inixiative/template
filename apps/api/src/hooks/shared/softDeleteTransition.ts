/**
 * @atlas
 * @kind helper
 * @partOf feature:auditLogs, feature:webhooks
 */
export const isSoftDeleteTransition = (
  previous?: Record<string, unknown>,
  record?: Record<string, unknown>,
): boolean => previous?.deletedAt == null && record?.deletedAt != null;
