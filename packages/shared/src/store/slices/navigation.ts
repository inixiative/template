import type { StateCreator } from 'zustand';
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

export const createNavigationSlice: StateCreator<NavigationSlice> = (set) => ({
  navigation: {
    navigate: null,
    navConfig: null,
    currentPath: '/',
    currentRouteMatch: null,

    setNavigate: (fn) =>
      set((state) => ({
        navigation: { ...state.navigation, navigate: fn },
      })),

    setNavConfig: (config) =>
      set((state) => ({
        navigation: { ...state.navigation, navConfig: config },
      })),

    setCurrentPath: (path) =>
      set((state) => ({
        navigation: { ...state.navigation, currentPath: path },
      })),

    setCurrentRouteMatch: (match) =>
      set((state) => ({
        navigation: { ...state.navigation, currentRouteMatch: match },
      })),
  },
});
