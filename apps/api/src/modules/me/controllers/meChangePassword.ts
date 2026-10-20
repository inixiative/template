/**
 * @atlas
 * @kind controller
 * @partOf feature:users, feature:auth
 * @uses primitive:routeTemplates
 */
import { auth } from '#/lib/auth';
import { withThrowawaySession } from '#/lib/auth/withThrowawaySession';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { meChangePasswordRoute } from '#/modules/me/routes/meChangePassword';
import { changePasswordResponseSchema } from '#/modules/me/schemas/changePasswordSchemas';

export const meChangePasswordController = makeController(
  meChangePasswordRoute,
  async (c, respond) => {
    const { currentPassword, newPassword } = c.req.valid('json');
    const handoff = await withThrowawaySession(c.get('user')!.id, (headers) =>
      auth.api.changePassword({
        body: { currentPassword, newPassword, revokeOtherSessions: true },
        headers,
      }),
    );
    const parsed = changePasswordResponseSchema.safeParse(handoff);
    if (!parsed.success) throw makeError({ status: 500 });
    return respond.ok(parsed.data);
  },
);
