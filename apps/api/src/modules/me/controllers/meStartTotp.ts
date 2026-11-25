/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses infrastructure:prisma, infrastructure:redis, primitive:errors
 */
import { assertEnrollmentAuthorization } from '#/lib/twoFactor/assertEnrollmentAuthorization';
import { twoFactorIssuerName } from '#/lib/twoFactor/passkey/resolveWebAuthnOrigin';
import { storePendingTotpSetup } from '#/lib/twoFactor/pendingTotpSetup';
import { generateTotpSetup } from '#/lib/twoFactor/totp/generateTotpSetup';
import { makeController } from '#/lib/utils/makeController';
import { meStartTotpRoute } from '#/modules/me/routes/meStartTotp';

export const meStartTotpController = makeController(meStartTotpRoute, async (c, respond) => {
  const user = c.get('user')!;
  const { currentPassword } = c.req.valid('json');
  await assertEnrollmentAuthorization(c, currentPassword);

  const setup = generateTotpSetup({ issuer: twoFactorIssuerName(), accountName: user.email });
  await storePendingTotpSetup(user.id, setup.secret);
  return respond.ok(setup);
});
