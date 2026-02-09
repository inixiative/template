import { useMemo } from 'react';
import { buildBreadcrumbs } from '../lib';
import { useAppStore } from '../store';

/**
 * Hook to generate breadcrumbs for the current page.
 * Gets route match and context from store automatically.
 */
export const useBreadcrumbs = (): { items: any[]; onNavigate: (href: string) => void } => {
  const currentRouteMatch = useAppStore((state) => state.navigation.currentRouteMatch);
  const context = useAppStore((state) => state.tenant.context);
  const pageContext = useAppStore((state) => state.tenant.page);
  const navigate = useAppStore((state) => state.navigation.navigate);

  const items = useMemo(
    () => (currentRouteMatch ? buildBreadcrumbs(currentRouteMatch, context, pageContext) : []),
    [currentRouteMatch, context, pageContext],
  );

  const onNavigate = (href: string) => navigate?.({ to: href });

  return useMemo(() => ({ items, onNavigate }), [items, navigate]);
};
