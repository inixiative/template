/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui
 */
import { buildBreadcrumbs } from '@template/ui/lib';
import { useAppStore } from '@template/ui/store';
import { useCallback, useMemo } from 'react';

type Breadcrumb = ReturnType<typeof buildBreadcrumbs>[number];

export const useBreadcrumbs = (): { items: Breadcrumb[]; onNavigate: (href: string) => void } => {
  const currentRouteMatch = useAppStore((state) => state.navigation.currentRouteMatch);
  const context = useAppStore((state) => state.tenant.context);
  const pageContext = useAppStore((state) => state.tenant.page);
  const spoofUserEmail = useAppStore((state) => state.auth.spoofUserEmail);
  const navigatePreserving = useAppStore((state) => state.navigation.navigatePreserving);

  const items = useMemo(
    () => (currentRouteMatch ? buildBreadcrumbs(currentRouteMatch, context, pageContext, spoofUserEmail) : []),
    [currentRouteMatch, context, pageContext, spoofUserEmail],
  );

  const onNavigate = useCallback((href: string) => navigatePreserving(href, 'context'), [navigatePreserving]);

  return useMemo(() => ({ items, onNavigate }), [items, onNavigate]);
};
