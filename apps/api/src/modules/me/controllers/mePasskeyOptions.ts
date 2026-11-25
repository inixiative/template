/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses infrastructure:prisma, infrastructure:redis, primitive:errors
 */
import { assertEnrollmentAuthorization } from '#/lib/twoFactor/assertEnrollmentAuthorization';
import { createPasskeyRegistrationOptions } from '#/lib/twoFactor/passkey/createPasskeyRegistrationOptions';
import { makeController } from '#/lib/utils/makeController';
import { mePasskeyOptionsRoute } from '#/modules/me/routes/mePasskeyOptions';

export const mePasskeyOptionsController = makeController(
  mePasskeyOptionsRoute,
  async (c, respond) => {
    const user = c.get('user')!;
    const { currentPassword } = c.req.valid('json');
    await assertEnrollmentAuthorization(c, currentPassword);

    return respond.ok(
      await createPasskeyRegistrationOptions({
        user,
        origin: c.req.header('origin'),
      }),
    );
  },
);
