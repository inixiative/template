import type { UseNavigateResult } from '@tanstack/react-router';
import type { NavConfig } from '@template/ui/components/layout/navigationTypes';
import type { RouteMatch } from '@template/ui/lib/findRoute';

export type NavigationSlice = {
  navigation: {
    navigate: ((options: { to: string; search?: Record<string, string> }) => void) | null;
    navConfig: NavConfig | null;
    currentRouteMatch: RouteMatch | null;
    setNavigate: (fn: UseNavigateResult<string>) => void;
    setNavConfig: (config: NavConfig) => void;
    setCurrentRouteMatch: (match: RouteMatch | null) => void;
    navigatePreservingContext: (to: string) => void;
    navigatePreservingSpoof: (to: string) => void;
  };
};
