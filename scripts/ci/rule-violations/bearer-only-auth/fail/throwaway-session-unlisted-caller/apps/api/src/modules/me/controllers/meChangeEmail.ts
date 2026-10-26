/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses none
 */
import { withThrowawaySession } from '#/lib/auth/withThrowawaySession';

export const changeEmail = (userId: string) => withThrowawaySession(userId, async () => null);
