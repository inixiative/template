/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui
 * @uses none
 */
import { buildBreadcrumbs } from '@template/ui/lib';
import { useAppStore } from '@template/ui/store';
import { useCallback, useMemo } from 'react';

type Breadcrumb = ReturnType<typeof buildBreadcrumbs>[number];

export const useBreadcrumbs = (): { items: Breadcrumb[]; onNavigate: (href: string) => void } => {
  const currentRouteMatch = useAppStore((state) => state.navigation.currentRouteMatch);
  const context = useAppStore((state) => state.tenant.context);
  const viewedRecords = useAppStore((state) => state.tenant.viewedRecords);
  const spoofUserEmail = useAppStore((state) => state.auth.spoofUserEmail);
  const navigateKeepingSearchParams = useAppStore(
    (state) => state.navigation.navigateKeepingSearchParams,
  );

  const items = useMemo(
    () =>
      currentRouteMatch
        ? buildBreadcrumbs(currentRouteMatch, context, viewedRecords, spoofUserEmail)
        : [],
    [currentRouteMatch, context, viewedRecords, spoofUserEmail],
  );

  const onNavigate = useCallback(
    (href: string) => navigateKeepingSearchParams(href, 'context'),
    [navigateKeepingSearchParams],
  );

  return useMemo(() => ({ items, onNavigate }), [items, onNavigate]);
};
