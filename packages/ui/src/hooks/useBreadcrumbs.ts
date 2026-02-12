import { useMemo } from 'react';
import { buildBreadcrumbs } from '@template/ui/lib';
import { useAppStore } from '@template/ui/store';

/**
 * Hook to generate breadcrumbs for the current page.
 * Gets route match and context from store automatically.
 */
export const useBreadcrumbs = (): { items: any[]; onNavigate: (href: string) => void } => {
  const currentRouteMatch = useAppStore((state) => state.navigation.currentRouteMatch);
  const context = useAppStore((state) => state.tenant.context);
  const pageContext = useAppStore((state) => state.tenant.page);
  const spoofUserEmail = useAppStore((state) => state.auth.spoofUserEmail);
  const navigatePreservingContext = useAppStore((state) => state.navigation.navigatePreservingContext);

  const items = useMemo(
    () => (currentRouteMatch ? buildBreadcrumbs(currentRouteMatch, context, pageContext, spoofUserEmail) : []),
    [currentRouteMatch, context, pageContext, spoofUserEmail],
  );

  const onNavigate = (href: string) => navigatePreservingContext(href);

  return useMemo(() => ({ items, onNavigate }), [items, navigatePreservingContext]);
};
