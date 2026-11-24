/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses infrastructure:prisma, infrastructure:redis, primitive:errors
 */
import { issueUserJwt } from '#/lib/auth/issueUserJwt';
import { isRecentTwoFactor } from '#/lib/twoFactor/assertRecentTwoFactor';
import {
  clearPendingTotpSetup,
  fetchPendingTotpSetupOrThrow,
} from '#/lib/twoFactor/pendingTotpSetup';
import { enableUserTotp } from '#/lib/twoFactor/totp/enableUserTotp';
import { verifyTotpCode } from '#/lib/twoFactor/totp/verifyTotpCode';
import { makeController } from '#/lib/utils/makeController';
import { meConfirmTotpRoute } from '#/modules/me/routes/meConfirmTotp';

export const meConfirmTotpController = makeController(meConfirmTotpRoute, async (c, respond) => {
  const user = c.get('user')!;
  const { code } = c.req.valid('json');
  const secret = await fetchPendingTotpSetupOrThrow(user.id);

  await verifyTotpCode({ userId: user.id, secret, code, status: 400 });
  const { backupCodes } = await enableUserTotp(user.id, secret, isRecentTwoFactor(c));
  await clearPendingTotpSetup(user.id);

  const jwt =
    !c.get('jwtTwoFactorVerified') && c.get('jwtIsPlatformIssued')
      ? await issueUserJwt(user, { twoFactorVerified: true, recentTwoFactor: true })
      : undefined;
  return respond.ok({ enabled: true, backupCodes, jwt });
});
