/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates
 */
import { actingUser } from '#/lib/context/actingUser';
import { pendingTwoFactorAction } from '#/lib/twoFactor/pendingTwoFactorAction';
import { makeController } from '#/lib/utils/makeController';
import { meReadRoute } from '#/modules/me/routes/meRead';

export const meReadController = makeController(meReadRoute, async (c, respond) => {
  const user = actingUser(c)!;
  const twoFactorAction = c.get('spoofedBy') ? null : pendingTwoFactorAction(c, user);

  return respond.ok({
    ...user,
    organizationUsers: twoFactorAction ? [] : (c.get('organizationUsers') ?? []),
    organizations: twoFactorAction ? [] : (c.get('organizations') ?? []),
    spaceUsers: twoFactorAction ? [] : (c.get('spaceUsers') ?? []),
    spaces: twoFactorAction ? [] : (c.get('spaces') ?? []),
    twoFactorAction,
  });
});
