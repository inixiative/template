/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses none
 */
import { withThrowawaySession } from '#/lib/auth/withThrowawaySession.js';

export const actAsUser = (userId: string) => withThrowawaySession(userId, async () => null);
