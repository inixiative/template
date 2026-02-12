import type { NavConfig } from '@template/ui/components';
import { publicContext } from '#/config/nav/contexts/publicContext';
import { userContext } from '#/config/nav/contexts/userContext';

export const navConfig: NavConfig = {
  user: userContext,
  organization: [],
  space: [],
  public: publicContext,
};
