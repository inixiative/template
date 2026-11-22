/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses infrastructure:prisma, infrastructure:redis, primitive:errors
 */
import { realUserActor } from '#/lib/context/realUserActor';
import { createPasskeyAuthenticationOptions } from '#/lib/twoFactor/passkey/createPasskeyAuthenticationOptions';
import { makeController } from '#/lib/utils/makeController';
import { meVerifyPasskeyOptionsRoute } from '#/modules/me/routes/meVerifyPasskeyOptions';

export const meVerifyPasskeyOptionsController = makeController(
  meVerifyPasskeyOptionsRoute,
  async (c, respond) => {
    const actor = realUserActor(c)!;
    const result = await createPasskeyAuthenticationOptions({
      userId: actor.id,
      origin: c.req.header('origin'),
    });
    return respond.ok(result);
  },
);
