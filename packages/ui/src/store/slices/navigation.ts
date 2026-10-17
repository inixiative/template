/**
 * @atlas
 * @kind store
 * @partOf primitive:ui
 * @uses none
 */
import { currentLocation } from '@template/ui/lib/currentLocation';
import { pickSearchParams, readSearchParam } from '@template/ui/lib/searchParams';
import type { AppStore } from '@template/ui/store/types';
import type { NavigationSlice } from '@template/ui/store/types/navigation';
import type { StateCreator } from 'zustand';

type Policy = 'context' | 'spoof' | 'all';

const resolveSearchForPolicy = (
  currentSearch: string,
  policy: Policy,
  spoofUserEmail: string | null,
  flowId: string | null,
): Record<string, string> | undefined => {
  if (policy === 'all') {
    const params = new URLSearchParams(currentSearch);
    const search: Record<string, string> = {};
    params.forEach((value, key) => {
      search[key] = value;
    });
    return Object.keys(search).length > 0 ? search : undefined;
  }

  const preservedContext =
    policy === 'context' ? pickSearchParams(currentSearch, ['org', 'space']) : undefined;
  const spoof = spoofUserEmail ?? readSearchParam(currentSearch, 'spoof');

  if (!preservedContext && !spoof && !flowId) return undefined;

  const search = { ...(preservedContext || {}) };
  if (spoof) search.spoof = spoof;
  if (flowId) search.flow = flowId;
  return search;
};

const parseNavigateTarget = (
  to: string,
): { path: string; hash: string; search?: Record<string, string> } => {
  const url = new URL(to, 'http://localhost');
  const search: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    search[key] = value;
  });

  const target = { path: url.pathname, hash: url.hash.slice(1) };
  return Object.keys(search).length > 0 ? { ...target, search } : target;
};

const mergeSearch = (
  left?: Record<string, string>,
  right?: Record<string, string>,
): Record<string, string> | undefined => {
  const merged = { ...(left || {}), ...(right || {}) };
  return Object.keys(merged).length > 0 ? merged : undefined;
};

export const createNavigationSlice: StateCreator<AppStore, [], [], NavigationSlice> = (
  set,
  get,
) => ({
  navigation: {
    navigate: null,
    navConfig: null,
    currentRouteMatch: null,
    flowId: null,

    setNavigate: (fn) =>
      set((state) => ({
        navigation: {
          ...state.navigation,
          navigate: ({ to, search, hash }) => {
            fn({ to, ...(search && { search }), ...(hash && { hash }) });
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
      const spoofUserEmail = get().auth.spoofUserEmail;
      const { search: currentSearch, hash } = currentLocation();
      const currentHash = hash.slice(1);
      const preservedSearch = resolveSearchForPolicy(
        currentSearch,
        policy,
        spoofUserEmail,
        get().navigation.flowId,
      );
      const target = parseNavigateTarget(to);
      navigate({
        to: target.path,
        search: mergeSearch(target.search, preservedSearch),
        hash: target.hash || currentHash,
      });
    },

    setFlowId: (flowId) => set((state) => ({ navigation: { ...state.navigation, flowId } })),
  },
});
