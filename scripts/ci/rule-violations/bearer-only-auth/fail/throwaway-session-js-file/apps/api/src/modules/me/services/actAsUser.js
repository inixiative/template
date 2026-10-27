/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses none
 */
import { withThrowawaySession } from '#/lib/auth/withThrowawaySession';

export const actAsUser = (userId) => withThrowawaySession(userId, async () => null);
