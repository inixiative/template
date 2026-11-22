/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses infrastructure:prisma, infrastructure:redis, primitive:errors
 */
import { issueUserJwt } from '#/lib/auth/issueUserJwt';
import { realUserActor } from '#/lib/context/realUserActor';
import { verifyUserFactor } from '#/lib/twoFactor/verifyUserFactor';
import { makeController } from '#/lib/utils/makeController';
import { meVerifyTwoFactorRoute } from '#/modules/me/routes/meVerifyTwoFactor';

export const meVerifyTwoFactorController = makeController(
  meVerifyTwoFactorRoute,
  async (c, respond) => {
    const actor = realUserActor(c)!;
    const body = c.req.valid('json');

    await verifyUserFactor(actor.id, body);
    const jwt = c.get('jwtIsLocalIssuer')
      ? await issueUserJwt(actor, { twoFactorVerified: true, recentTwoFactor: true })
      : undefined;
    return respond.ok({ jwt });
  },
);
