/**
 * @atlas
 * @kind store
 * @partOf primitive:ui
 * @uses none
 */
import type { Flow } from '@template/sdk';
import { pickSearchParams, readSearchParam } from '@template/ui/lib/searchParams';
import type { AppStore } from '@template/ui/store/types';
import type { FlowContinue, NavigationSlice } from '@template/ui/store/types/navigation';
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

const flowContinueAfter = (flow: Flow): FlowContinue => {
  const next = flow.steps[flow.currentStep];
  return next
    ? { label: `Continue: ${next.label}`, to: next.to }
    : { label: 'Finish', to: flow.returnUrl ?? '/dashboard' };
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
    flow: null,
    flowContinue: null,

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
      const currentSearch = typeof window === 'undefined' ? '' : (window.location?.search ?? '');
      const currentHash =
        typeof window === 'undefined' ? '' : (window.location?.hash ?? '').slice(1);
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

    setFlowId: (flowId) =>
      set((state) => ({
        navigation: { ...state.navigation, flowId, flow: null, flowContinue: null },
      })),

    receiveFlow: (flow) => {
      const { navigation } = get();
      const previous = navigation.flow?.id === flow.id ? navigation.flow : null;
      const finished = flow.currentStep >= flow.steps.length;
      const advanced = previous !== null && flow.currentStep > previous.currentStep;
      const completedStep = flow.steps[flow.currentStep - 1];
      const flowContinue = advanced
        ? flowContinueAfter(flow)
        : flow.currentStep < (previous?.currentStep ?? 0)
          ? null
          : navigation.flowContinue;

      set((state) => ({
        navigation: {
          ...state.navigation,
          flowId: finished ? null : flow.id,
          flow,
          flowContinue,
        },
      }));
      if (advanced && completedStep?.advance === 'auto') get().navigation.continueFlow();
    },

    continueFlow: () => {
      const { flowContinue, flowId, navigatePreserving } = get().navigation;
      set((state) => ({
        navigation: {
          ...state.navigation,
          flowContinue: null,
          flow: flowId ? state.navigation.flow : null,
        },
      }));
      if (flowContinue?.to) navigatePreserving(flowContinue.to, 'context');
    },

    clearFlow: () =>
      set((state) => ({
        navigation: { ...state.navigation, flowId: null, flow: null, flowContinue: null },
      })),
  },
});
