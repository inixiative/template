/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses infrastructure:prisma
 */
import { fetchUserTwoFactorStatus } from '#/lib/twoFactor/fetchUserTwoFactorStatus';
import { rpIdFromOrigin } from '#/lib/twoFactor/passkey/resolveWebAuthnOrigin';
import { makeController } from '#/lib/utils/makeController';
import { meReadTwoFactorRoute } from '#/modules/me/routes/meReadTwoFactor';

export const meReadTwoFactorController = makeController(
  meReadTwoFactorRoute,
  async (c, respond) => {
    const user = c.get('user')!;
    const status = await fetchUserTwoFactorStatus(user.id, rpIdFromOrigin(c.req.header('origin')));
    return respond.ok(status);
  },
);
