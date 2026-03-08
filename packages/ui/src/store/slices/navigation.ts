import type { UseNavigateResult } from '@tanstack/react-router';
import type { NavConfig } from '@template/ui/components/layout/navigationTypes';
import type { RouteMatch } from '@template/ui/lib/findRoute';
import { pickSearchParams, readSearchParam } from '@template/ui/lib/searchParams';
import type { AppStore } from '@template/ui/store/types';
import type { StateCreator } from 'zustand';

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
    navigatePreservingAll: (to: string) => void;
  };
};

const resolveSearchForPolicy = (
  currentSearch: string,
  policy: 'context' | 'spoof' | 'all',
  spoofUserEmail: string | null,
): Record<string, string> | undefined => {
  if (policy === 'all') {
    const params = new URLSearchParams(currentSearch);
    const search: Record<string, string> = {};
    params.forEach((value, key) => {
      search[key] = value;
    });
    return Object.keys(search).length > 0 ? search : undefined;
  }

  const preservedContext = policy === 'context' ? pickSearchParams(currentSearch, ['org', 'space']) : undefined;
  const spoof = spoofUserEmail ?? readSearchParam(currentSearch, 'spoof');

  if (!preservedContext && !spoof) {
    return undefined;
  }

  const search = { ...(preservedContext || {}) };
  if (spoof) {
    search.spoof = spoof;
  }

  return search;
};

const parseNavigateTarget = (to: string): { path: string; search?: Record<string, string> } => {
  const url = new URL(to, 'http://localhost');
  const search: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    search[key] = value;
  });

  const path = `${url.pathname}${url.hash}`;
  return Object.keys(search).length > 0 ? { path, search } : { path };
};

const mergeSearch = (
  left?: Record<string, string>,
  right?: Record<string, string>,
): Record<string, string> | undefined => {
  const merged = { ...(left || {}), ...(right || {}) };
  return Object.keys(merged).length > 0 ? merged : undefined;
};

export const createNavigationSlice: StateCreator<AppStore, [], [], NavigationSlice> = (set, get) => ({
  navigation: {
    navigate: null,
    navConfig: null,
    currentRouteMatch: null,

    setNavigate: (fn) =>
      set((state) => ({
        navigation: {
          ...state.navigation,
          navigate: ({ to, search }) => {
            if (search) {
              fn({ to, search });
              return;
            }
            fn({ to });
          },
        },
      })),

    setNavConfig: (config) =>
      set((state) => ({
        navigation: { ...state.navigation, navConfig: config },
      })),

    setCurrentRouteMatch: (match) =>
      set((state) => ({
        navigation: { ...state.navigation, currentRouteMatch: match },
      })),

    navigatePreservingContext: (to) => {
      const navigate = get().navigation.navigate;
      if (!navigate) return;
      const spoofUserEmail = get().auth.spoofUserEmail;
      const currentSearch = typeof window === 'undefined' ? '' : (window.location?.search ?? '');
      const currentHash = typeof window === 'undefined' ? '' : (window.location?.hash ?? '');
      const preservedSearch = resolveSearchForPolicy(currentSearch, 'context', spoofUserEmail);
      const target = parseNavigateTarget(to);
      const finalPath = target.path.includes('#') ? target.path : `${target.path}${currentHash}`;
      const search = mergeSearch(target.search, preservedSearch);
      navigate({ to: finalPath, search });
    },

    navigatePreservingSpoof: (to) => {
      const navigate = get().navigation.navigate;
      if (!navigate) return;
      const spoofUserEmail = get().auth.spoofUserEmail;
      const currentSearch = typeof window === 'undefined' ? '' : (window.location?.search ?? '');
      const currentHash = typeof window === 'undefined' ? '' : (window.location?.hash ?? '');
      const preservedSearch = resolveSearchForPolicy(currentSearch, 'spoof', spoofUserEmail);
      const target = parseNavigateTarget(to);
      const finalPath = target.path.includes('#') ? target.path : `${target.path}${currentHash}`;
      const search = mergeSearch(target.search, preservedSearch);
      navigate({ to: finalPath, search });
    },

    navigatePreservingAll: (to) => {
      const navigate = get().navigation.navigate;
      if (!navigate) return;
      const spoofUserEmail = get().auth.spoofUserEmail;
      const currentSearch = typeof window === 'undefined' ? '' : (window.location?.search ?? '');
      const currentHash = typeof window === 'undefined' ? '' : (window.location?.hash ?? '');
      const preservedSearch = resolveSearchForPolicy(currentSearch, 'all', spoofUserEmail);
      const target = parseNavigateTarget(to);
      const finalPath = target.path.includes('#') ? target.path : `${target.path}${currentHash}`;
      const search = mergeSearch(target.search, preservedSearch);
      navigate({ to: finalPath, search });
    },
  },
});
