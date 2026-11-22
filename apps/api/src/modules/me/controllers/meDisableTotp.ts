/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses infrastructure:prisma, primitive:errors
 */
import { disableUserTotp } from '#/lib/twoFactor/totp/disableUserTotp';
import { makeController } from '#/lib/utils/makeController';
import { meDisableTotpRoute } from '#/modules/me/routes/meDisableTotp';

export const meDisableTotpController = makeController(meDisableTotpRoute, async (c, respond) => {
  const user = c.get('user')!;
  await disableUserTotp(user.id);
  return respond.noContent();
});
