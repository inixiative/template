import type { NavConfig } from '@template/ui/components';
import { organizationNavigationItems } from '#/config/nav/navigationByContext/organizationNavigationItems';
import { publicNavigationItems } from '#/config/nav/navigationByContext/publicNavigationItems';
import { spaceNavigationItems } from '#/config/nav/navigationByContext/spaceNavigationItems';
import { userNavigationItems } from '#/config/nav/navigationByContext/userNavigationItems';

export const navConfig: NavConfig = {
  user: userNavigationItems,
  organization: organizationNavigationItems,
  space: spaceNavigationItems,
  public: publicNavigationItems,
};
