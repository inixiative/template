/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui
 * @uses none
 */
import { useAppStore } from '@template/ui/store';
import type { ViewedRecords } from '@template/ui/store/types/tenant';
import { useEffect, useMemo } from 'react';

export const useDocumentTitleAndDescription = (): { title: string; description: string } => {
  const appName = useAppStore((state) => state.ui.appName);
  const appDescription = useAppStore((state) => state.ui.description);
  const currentRouteMatch = useAppStore((state) => state.navigation.currentRouteMatch);
  const context = useAppStore((state) => state.tenant.context);
  const viewedRecords = useAppStore((state) => state.tenant.viewedRecords);

  const { title, description } = useMemo(() => {
    if (!currentRouteMatch) {
      return {
        title: appName,
        description: appDescription,
      };
    }

    // Handle custom title or fallback to breadcrumbs
    let title: string;
    if (currentRouteMatch.item.title) {
      const titleValue = currentRouteMatch.item.title;
      title = typeof titleValue === 'function' ? titleValue(context, viewedRecords) : titleValue;
    } else {
      // Fallback to breadcrumb chain
      const labels = currentRouteMatch.chain.map((item) => {
        let label = item.label;

        if (item.breadcrumbLabel && viewedRecords) {
          const recordKey = Object.keys(viewedRecords).find((key) =>
            item.label.toLowerCase().includes(key.toLowerCase()),
          ) as keyof ViewedRecords | undefined;
          if (recordKey && viewedRecords[recordKey]) {
            label = item.breadcrumbLabel(viewedRecords[recordKey]);
          }
        }

        return label;
      });
      title = labels.join(' | ');
    }

    // Handle context-aware descriptions
    let description = appDescription;
    if (currentRouteMatch.item.description) {
      const descriptionValue = currentRouteMatch.item.description;
      description =
        typeof descriptionValue === 'function'
          ? descriptionValue(context, viewedRecords)
          : descriptionValue;
    }

    return { title, description };
  }, [appName, appDescription, currentRouteMatch, context, viewedRecords]);

  useEffect(() => {
    document.title = `${appName} | ${title}`;

    let descriptionMeta = document.querySelector('meta[name="description"]');
    if (!descriptionMeta) {
      descriptionMeta = document.createElement('meta');
      descriptionMeta.setAttribute('name', 'description');
      document.head.appendChild(descriptionMeta);
    }
    descriptionMeta.setAttribute('content', description);
  }, [title, description, appName]);

  return { title, description };
};
