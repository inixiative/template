/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates
 */
import type { TwoFactorAction } from '@template/shared/auth/twoFactor';
import type { Context } from 'hono';
import { actingUser } from '#/lib/context/actingUser';
import { isTwoFactorRequired } from '#/lib/twoFactor/isTwoFactorRequired';
import { makeController } from '#/lib/utils/makeController';
import { meReadRoute } from '#/modules/me/routes/meRead';
import type { AppEnv } from '#/types/appEnv';

const twoFactorActionFor = (
  c: Context<AppEnv>,
  twoFactorEnabled: boolean,
): TwoFactorAction | null => {
  if (c.get('token') || c.get('spoofedBy')) return null;
  if (isTwoFactorRequired() && !twoFactorEnabled) return 'enroll';
  if (c.get('jwtTwoFactorVerified')) return null;
  return twoFactorEnabled ? 'verify' : null;
};

export const meReadController = makeController(meReadRoute, async (c, respond) => {
  const user = actingUser(c)!;
  const twoFactorAction = twoFactorActionFor(c, user.twoFactorEnabled);

  return respond.ok({
    ...user,
    organizationUsers: twoFactorAction ? [] : (c.get('organizationUsers') ?? []),
    organizations: twoFactorAction ? [] : (c.get('organizations') ?? []),
    spaceUsers: twoFactorAction ? [] : (c.get('spaceUsers') ?? []),
    spaces: twoFactorAction ? [] : (c.get('spaces') ?? []),
    twoFactorAction,
  });
});
