import type { NavConfig } from '@template/ui/components';
import { publicNavigationItems } from '#/config/nav/navigationByContext/publicNavigationItems';
import { userNavigationItems } from '#/config/nav/navigationByContext/userNavigationItems';

export const navConfig: NavConfig = {
  user: userNavigationItems,
  organization: [],
  space: [],
  public: publicNavigationItems,
};
