import type { NavConfig } from '@template/ui';
import type { RouteMatch } from '../../lib/findRoute';

export type NavigationSlice = {
  navigation: {
    navigate: ((options: any) => void) | null;
    navConfig: NavConfig | null;
    currentPath: string;
    currentRouteMatch: RouteMatch | null;
    setNavigate: (fn: (options: any) => void) => void;
    setNavConfig: (config: NavConfig) => void;
    setCurrentPath: (path: string) => void;
    setCurrentRouteMatch: (match: RouteMatch | null) => void;
  };
};
