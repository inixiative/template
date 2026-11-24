/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses infrastructure:prisma, infrastructure:redis, primitive:errors
 */
import { issueUserJwt } from '#/lib/auth/issueUserJwt';
import { verifyUserFactor } from '#/lib/twoFactor/verifyUserFactor';
import { makeController } from '#/lib/utils/makeController';
import { meVerifyTwoFactorRoute } from '#/modules/me/routes/meVerifyTwoFactor';

export const meVerifyTwoFactorController = makeController(
  meVerifyTwoFactorRoute,
  async (c, respond) => {
    const sessionUser = c.get('spoofedBy') ?? c.get('user')!;
    const body = c.req.valid('json');

    await verifyUserFactor(sessionUser.id, body);
    const jwt = c.get('jwtIsPlatformIssued')
      ? await issueUserJwt(sessionUser, { twoFactorVerified: true, recentTwoFactor: true })
      : undefined;
    return respond.ok({ jwt });
  },
);
