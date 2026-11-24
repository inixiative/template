/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses infrastructure:prisma, infrastructure:redis, primitive:errors
 */
import { createPasskeyAuthenticationOptions } from '#/lib/twoFactor/passkey/createPasskeyAuthenticationOptions';
import { makeController } from '#/lib/utils/makeController';
import { meVerifyPasskeyOptionsRoute } from '#/modules/me/routes/meVerifyPasskeyOptions';

export const meVerifyPasskeyOptionsController = makeController(
  meVerifyPasskeyOptionsRoute,
  async (c, respond) => {
    const sessionUser = c.get('spoofedBy') ?? c.get('user')!;
    const result = await createPasskeyAuthenticationOptions({
      userId: sessionUser.id,
      origin: c.req.header('origin'),
    });
    return respond.ok(result);
  },
);
