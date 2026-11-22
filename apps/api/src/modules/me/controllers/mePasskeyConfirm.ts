/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses infrastructure:prisma, infrastructure:redis, primitive:errors
 */
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { issueUserJwt } from '#/lib/auth/issueUserJwt';
import { isRecentTwoFactor } from '#/lib/twoFactor/assertRecentTwoFactor';
import { registerUserPasskey } from '#/lib/twoFactor/passkey/registerUserPasskey';
import { verifyPasskeyRegistrationOrThrow } from '#/lib/twoFactor/passkey/verifyPasskeyResponseOrThrow';
import { consumePendingWebAuthnChallengeOrThrow } from '#/lib/twoFactor/pendingWebAuthnChallenge';
import { makeController } from '#/lib/utils/makeController';
import { mePasskeyConfirmRoute } from '#/modules/me/routes/mePasskeyConfirm';

export const mePasskeyConfirmController = makeController(
  mePasskeyConfirmRoute,
  async (c, respond) => {
    const user = c.get('user')!;
    const { name, response } = c.req.valid('json');
    const challenge = await consumePendingWebAuthnChallengeOrThrow('register', user.id);
    const registrationInfo = await verifyPasskeyRegistrationOrThrow({
      response: response as unknown as RegistrationResponseJSON,
      expectedChallenge: challenge.challenge,
      expectedOrigin: challenge.expectedOrigin,
      expectedRPID: challenge.rpId,
      requireUserVerification: false,
    });
    const result = await registerUserPasskey({
      userId: user.id,
      name,
      rpId: challenge.rpId,
      registrationInfo,
      recentlyVerified: isRecentTwoFactor(c),
    });

    const jwt =
      !c.get('jwtTwoFactorVerified') && c.get('jwtIsLocalIssuer')
        ? await issueUserJwt(user, { twoFactorVerified: true, recentTwoFactor: true })
        : undefined;
    return respond.ok({ ...result, jwt });
  },
);
