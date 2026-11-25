/**
 * @atlas
 * @kind controller
 * @partOf feature:auth
 * @uses infrastructure:prisma, primitive:errors
 */
import { regenerateUserBackupCodes } from '#/lib/twoFactor/totp/regenerateUserBackupCodes';
import { makeController } from '#/lib/utils/makeController';
import { meRegenerateBackupCodesRoute } from '#/modules/me/routes/meRegenerateBackupCodes';

export const meRegenerateBackupCodesController = makeController(
  meRegenerateBackupCodesRoute,
  async (c, respond) => {
    const user = c.get('user')!;
    return respond.ok(await regenerateUserBackupCodes(user.id));
  },
);
