/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses none
 */
export const actAsUser = async (userId: string) => (await import('#/lib/auth/withThrowawaySession')).withThrowawaySession(userId, async () => null);
