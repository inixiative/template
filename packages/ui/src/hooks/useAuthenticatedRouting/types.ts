import type { NavConfig } from '@template/ui/components/layout/navigationTypes';
import type { TenantContext, PageContext } from '@template/ui/store/types/tenant';
import type { AppStore } from '@template/ui/store/types';

export type RoutingSearchParams = {
  organizationId: string | null;
  spaceId: string | null;
  spoofEmail: string | null;
};

export type UrlSearchParamUpdates = Partial<Record<'org' | 'space' | 'spoof', string | null>>;

export type RoutingContextResolutionInput = {
  path: string;
  permissions: AppStore['permissions'];
  context: TenantContext;
  page: PageContext;
  organizations: AppStore['auth']['organizations'];
  navConfig: NavConfig;
};
