/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui
 * @uses none
 */
import { useLocation } from '@tanstack/react-router';
import { useActiveFlow } from '@template/ui/hooks/flow/useActiveFlow';
import {
  applyAuthorizedContext,
  hasContextChanged,
} from '@template/ui/hooks/useAuthenticatedRouting/contextAccess';
import {
  parseRoutingSearchParams,
  syncStoreFromSearchParams,
} from '@template/ui/hooks/useAuthenticatedRouting/querySync';
import {
  buildSearchParamUpdates,
  replaceUrlSearchParams,
} from '@template/ui/hooks/useAuthenticatedRouting/urlSync';
import { checkContextPermission } from '@template/ui/lib/checkContextPermission';
import { findRoute } from '@template/ui/lib/findRoute';
import { dropFlow } from '@template/ui/lib/flows/dropFlow';
import { isOnFlowPath } from '@template/ui/lib/flows/isOnFlowPath';
import { useAppStore } from '@template/ui/store';
import { useEffect, useRef, useState } from 'react';

export const useAuthenticatedRouting = (): { isAuthorized: boolean } => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const { pathname, search } = useLocation();
  const navigatePreserving = useAppStore((state) => state.navigation.navigatePreserving);
  const navConfig = useAppStore((state) => state.navigation.navConfig);
  const setCurrentRouteMatch = useAppStore((state) => state.navigation.setCurrentRouteMatch);
  const tenant = useAppStore((state) => state.tenant);
  const permissions = useAppStore((state) => state.permissions);
  const auth = useAppStore((state) => state.auth);
  const flowId = useAppStore((state) => state.navigation.flowId);
  const flow = useActiveFlow();
  const urlFlowId = parseRoutingSearchParams(search).flowId;

  // Handle context from query params (async for spoof)
  useEffect(() => {
    (async () => {
      const searchParams = parseRoutingSearchParams(search);
      syncStoreFromSearchParams({ searchParams, tenant, auth });

      if (searchParams.spoofEmail !== auth.spoofUserEmail) {
        useAppStore.getState().navigation.setFlowId(null);
        await auth.setSpoof(searchParams.spoofEmail);
      }
    })();
  }, [search, auth, tenant]);

  useEffect(() => {
    const { navigation } = useAppStore.getState();
    if (urlFlowId && urlFlowId !== navigation.flowId) navigation.setFlowId(urlFlowId);
  }, [urlFlowId]);

  // Update URL when context or spoof changes
  useEffect(() => {
    const searchParams = parseRoutingSearchParams(search);
    const updates = buildSearchParamUpdates({
      searchParams,
      context: tenant.context,
      spoofUserEmail: auth.spoofUserEmail,
      flowId,
    });

    if (updates) replaceUrlSearchParams(updates);
  }, [
    tenant.context.type,
    tenant.context.organization?.id,
    tenant.context.space?.id,
    auth.spoofUserEmail,
    flowId,
    search,
    tenant.context,
  ]);

  useEffect(() => {
    if (isAuthorized && flow && !isOnFlowPath(pathname, flow)) dropFlow();
  }, [isAuthorized, flow, pathname]);

  // Check permissions and fallback to valid context
  useEffect(() => {
    if (!navConfig) return;

    const authorizedContext = checkContextPermission({
      path: pathname,
      navConfig,
      permissions,
      context: tenant.context,
      page: tenant.page,
      organizations: auth.organizations,
    });

    if (!authorizedContext) {
      setCurrentRouteMatch(null);
      return setIsAuthorized(false);
    }
    setIsAuthorized(true);
    setCurrentRouteMatch(findRoute(pathname, navConfig, authorizedContext.type));

    if (hasContextChanged(tenant.context, authorizedContext))
      applyAuthorizedContext({ tenant, context: authorizedContext });
  }, [navConfig, pathname, tenant, auth.organizations, permissions, setCurrentRouteMatch]);

  // Auto-navigate to dashboard when context changes on same page
  const previousPathname = useRef('');
  const previousContextType = useRef('');
  useEffect(() => {
    const prevContextType = previousContextType.current;
    previousContextType.current = tenant.context.type;

    if (!previousPathname.current) {
      previousPathname.current = pathname;
      return;
    }

    // Skip redirect when context is being initialized from URL params (public → org/space)
    if (prevContextType === 'public' || prevContextType === '') return;

    if (pathname === previousPathname.current) navigatePreserving('/dashboard', 'context');
    previousPathname.current = pathname;
  }, [tenant.context.type, navigatePreserving, pathname]);

  return { isAuthorized };
};
