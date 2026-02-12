import { useEffect, useMemo } from 'react';
import { useAppStore } from '@template/ui/store';
import type { PageContext } from '@template/ui/store/types/tenant';

/**
 * Sets page title and meta description from cached route match.
 * Automatically updates document.title and meta description tag.
 */
export const usePageMeta = (): { title: string; description: string } => {
  const appName = useAppStore((state) => state.ui.appName);
  const appDescription = useAppStore((state) => state.ui.description);
  const currentRouteMatch = useAppStore((state) => state.navigation.currentRouteMatch);
  const context = useAppStore((state) => state.tenant.context);
  const pageContext = useAppStore((state) => state.tenant.page);

  const { title, description } = useMemo(() => {
    if (!currentRouteMatch) {
      return {
        title: appName,
        description: appDescription,
      };
    }

    // Handle custom title or fallback to breadcrumbs
    let title;
    if (currentRouteMatch.item.title) {
      const titleValue = currentRouteMatch.item.title;
      title = typeof titleValue === 'function'
        ? titleValue(context, pageContext)
        : titleValue;
    } else {
      // Fallback to breadcrumb chain
      const labels = currentRouteMatch.chain.map((item) => {
        let label = item.label;

        if (item.breadcrumbLabel && pageContext) {
          const recordKey = Object.keys(pageContext).find((key) =>
            item.label.toLowerCase().includes(key.toLowerCase()),
          ) as keyof PageContext | undefined;
          if (recordKey && pageContext[recordKey]) {
            label = item.breadcrumbLabel(pageContext[recordKey]);
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
      description = typeof descriptionValue === 'function'
        ? descriptionValue(context, pageContext)
        : descriptionValue;
    }

    return { title, description };
  }, [appName, appDescription, currentRouteMatch, context, pageContext]);

  useEffect(() => {
    document.title = `${appName} | ${title}`;

    let descriptionMeta = document.querySelector('meta[name="description"]');
    if (!descriptionMeta) {
      descriptionMeta = document.createElement('meta');
      descriptionMeta.setAttribute('name', 'description');
      document.head.appendChild(descriptionMeta);
    }
    descriptionMeta.setAttribute('content', description);
  }, [title, description]);

  return { title, description };
};
