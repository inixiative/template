import { useLocation } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@template/ui/store';
import { applyAuthorizedContext, hasContextChanged, resolveAuthorizedContext } from '@template/ui/hooks/useAuthenticatedRouting/contextAccess';
import { parseRoutingSearchParams, syncStoreFromSearchParams } from '@template/ui/hooks/useAuthenticatedRouting/querySync';
import { buildSearchParamUpdates, replaceUrlSearchParams } from '@template/ui/hooks/useAuthenticatedRouting/urlSync';

/**
 * Handles all routing logic for authenticated layouts:
 * - Reads context from query params (?org=123, ?space=456)
 * - Syncs context changes back to URL
 * - Checks permissions and falls back to valid contexts
 * - Auto-navigates to dashboard when context changes
 *
 * Future embed mode:
 * - Parent injects context via query params: ?org=123&token=abc
 * - skipAutoNavigation keeps user on embedded page
 * - onContextChange notifies parent for deep linking
 * - Use with useAuthStrategy for token auth from parent window
 */
export const useAuthenticatedRouting = (): { isAuthorized: boolean } => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const { pathname, search } = useLocation();
  const navigatePreservingSpoof = useAppStore((state) => state.navigation.navigatePreservingSpoof);
  const navConfig = useAppStore((state) => state.navigation.navConfig);
  const tenant = useAppStore((state) => state.tenant);
  const permissions = useAppStore((state) => state.permissions);
  const auth = useAppStore((state) => state.auth);

  // Handle context from query params (async for spoof)
  useEffect(() => {
    (async () => {
      const searchParams = parseRoutingSearchParams(search);
      syncStoreFromSearchParams({ searchParams, tenant, auth });

      if (searchParams.spoofEmail !== auth.spoofUserEmail) {
        await auth.setSpoof(searchParams.spoofEmail);
      }
    })();
  }, [search]);

  // Update URL when context or spoof changes
  useEffect(() => {
    const searchParams = parseRoutingSearchParams(search);
    const updates = buildSearchParamUpdates({
      searchParams,
      context: tenant.context,
      spoofUserEmail: auth.spoofUserEmail,
    });

    if (updates) replaceUrlSearchParams(updates);
  }, [tenant.context.type, tenant.context.organization?.id, tenant.context.space?.id, auth.spoofUserEmail]);

  // Check permissions and fallback to valid context
  useEffect(() => {
    const authorizedContext = resolveAuthorizedContext({
      path: pathname,
      navConfig: navConfig!,
      permissions,
      context: tenant.context,
      page: tenant.page,
      organizations: auth.organizations,
    });

    if (!authorizedContext) return setIsAuthorized(false);
    setIsAuthorized(true);

    if (hasContextChanged(tenant.context, authorizedContext))
      applyAuthorizedContext({ tenant, context: authorizedContext });
  }, [pathname, tenant.context.type, tenant.context.organization?.id, tenant.context.space?.id, auth.spoofUserEmail]);

  // Auto-navigate to dashboard when context changes on same page
  const previousPathname = useRef('');
  useEffect(() => {
    if (!previousPathname.current) {
      previousPathname.current = pathname;
      return;
    }
    if (pathname === previousPathname.current) navigatePreservingSpoof('/dashboard');
    previousPathname.current = pathname;
  }, [tenant.context.type, tenant.context.organization?.id, tenant.context.space?.id]);

  return { isAuthorized };
};
