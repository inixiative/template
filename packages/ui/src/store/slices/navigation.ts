/**
 * @atlas
 * @kind store
 * @partOf primitive:ui
 * @uses none
 */
import { resolveNavigationTarget } from '@template/ui/lib/resolveNavigationTarget';
import type { AppStore } from '@template/ui/store/types';
import type { NavigationSlice } from '@template/ui/store/types/navigation';
import type { StateCreator } from 'zustand';

export const createNavigationSlice: StateCreator<AppStore, [], [], NavigationSlice> = (
  set,
  get,
) => ({
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

    navigatePreserving: (to, policy) => {
      const navigate = get().navigation.navigate;
      if (!navigate) return;
      const target = resolveNavigationTarget(to, policy, {
        search: typeof window === 'undefined' ? '' : (window.location?.search ?? ''),
        hash: typeof window === 'undefined' ? '' : (window.location?.hash ?? ''),
        spoofUserEmail: get().auth.spoofUserEmail,
      });
      navigate({ to: `${target.pathname}${target.hash}`, search: target.search });
    },
  },
});
