/**
 * @atlas
 * @kind controller
 * @partOf feature:users, feature:auth
 * @uses primitive:routeTemplates
 */
import { auth } from '#/lib/auth';
import { withThrowawaySession } from '#/lib/auth/withThrowawaySession';
import { me } from '#/lib/context/me';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { meChangePasswordRoute } from '#/modules/me/routes/meChangePassword';
import { userJwtHandoffSchema } from '#/modules/me/schemas/changePasswordSchemas';

export const meChangePasswordController = makeController(
  meChangePasswordRoute,
  async (c, respond) => {
    const { currentPassword, newPassword } = c.req.valid('json');
    const handoff = await withThrowawaySession(me(c)!.id, (headers) =>
      auth.api.changePassword({
        body: { currentPassword, newPassword, revokeOtherSessions: true },
        headers,
      }),
    );
    const parsed = userJwtHandoffSchema.safeParse(handoff);
    if (!parsed.success) throw makeError({ status: 500 });
    if (c.get('spoofedBy')) return respond.ok({ token: null, expiresAt: null });
    return respond.ok(parsed.data);
  },
);
