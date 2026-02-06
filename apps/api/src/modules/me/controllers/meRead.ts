
import { makeController } from '#/lib/utils/makeController';
import { meReadRoute } from '#/modules/me/routes/meRead';

export const meReadController = makeController(meReadRoute, async (c, respond) => {
  const user = c.get('user')!;
  const organizationUsers = c.get('organizationUsers');
  const organizations = c.get('organizations');
  const spaceUsers = c.get('spaceUsers');
  const spaces = c.get('spaces');

  return respond.ok({
    ...user,
    organizationUsers: organizationUsers || [],
    organizations: organizations || [],
    spaceUsers: spaceUsers || [],
    spaces: spaces || [],
  });
});
