import type { NavConfig } from '@template/ui/components';
import { organizationContext } from '#/config/nav/contexts/organizationContext';
import { publicContext } from '#/config/nav/contexts/publicContext';
import { spaceContext } from '#/config/nav/contexts/spaceContext';
import { userContext } from '#/config/nav/contexts/userContext';

export const navConfig: NavConfig = {
  user: userContext,
  organization: organizationContext,
  space: spaceContext,
  public: publicContext,
};
