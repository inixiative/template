/**
 * @atlas
 * @kind type, store
 * @partOf primitive:ui
 * @uses none
 */
import type { UseNavigateResult } from '@tanstack/react-router';
import type { Flow } from '@template/sdk';
import type { NavConfig } from '@template/ui/components/layout/navigationTypes';
import type { RouteMatch } from '@template/ui/lib/findRoute';

export type FlowContinue = { label: string; to: string | null };

export type NavigationSlice = {
  navigation: {
    navigate:
      | ((options: { to: string; search?: Record<string, string>; hash?: string }) => void)
      | null;
    navConfig: NavConfig | null;
    currentRouteMatch: RouteMatch | null;
    flowId: string | null;
    flow: Flow | null;
    flowContinue: FlowContinue | null;
    setNavigate: (fn: UseNavigateResult<string>) => void;
    setNavConfig: (config: NavConfig) => void;
    setCurrentRouteMatch: (match: RouteMatch | null) => void;
    navigatePreserving: (to: string, policy: 'context' | 'spoof' | 'all') => void;
    setFlowId: (id: string | null) => void;
    receiveFlow: (flow: Flow) => void;
    continueFlow: () => void;
    clearFlow: () => void;
  };
};
