/**
 * @atlas
 * @kind type, store
 * @partOf primitive:ui
 * @uses none
 */
import type { UseNavigateResult } from '@tanstack/react-router';
import type { NavConfig } from '@template/ui/components/layout/navigationTypes';
import type { RouteMatch } from '@template/ui/lib/findRoute';

export type SearchParamsToKeep = 'context' | 'spoof' | 'all';

export type NavigationSlice = {
  navigation: {
    navigate:
      | ((options: {
          to: string;
          search?: Record<string, string>;
          hash?: string;
          replace?: boolean;
        }) => void)
      | null;
    navConfig: NavConfig | null;
    currentRouteMatch: RouteMatch | null;
    flowId: string | null;
    setNavigate: (fn: UseNavigateResult<string>) => void;
    setNavConfig: (config: NavConfig) => void;
    setCurrentRouteMatch: (match: RouteMatch | null) => void;
    navigateKeepingSearchParams: (to: string, searchParamsToKeep: SearchParamsToKeep) => void;
    setFlowId: (id: string | null) => void;
  };
};
