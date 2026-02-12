import type { RouteMatch } from '@template/ui/lib/findRoute';
import type { TenantContext } from '@template/ui/store/types/tenant';

export type Breadcrumb = {
  label: string;
  href: string;
};

export const buildBreadcrumbs = (
  match: RouteMatch,
  context: TenantContext,
  pageContext?: Record<string, any>,
  spoofUserEmail?: string | null,
): Breadcrumb[] => {
  const breadcrumbs: Breadcrumb[] = [];
  let currentPath = '';

  const contextParams = new URLSearchParams();
  if (context.type === 'organization' && context.organization) {
    contextParams.set('org', context.organization.id);
  } else if (context.type === 'space' && context.space) {
    contextParams.set('space', context.space.id);
  }
  if (spoofUserEmail) {
    contextParams.set('spoof', spoofUserEmail);
  }
  const queryString = contextParams.toString();

  for (let i = 0; i < match.chain.length; i++) {
    const item = match.chain[i];
    const segment = item.path || '';
    currentPath += segment;

    let resolvedPath = currentPath;
    for (const [key, value] of Object.entries(match.params)) {
      resolvedPath = resolvedPath.replace(`:${key}`, value);
    }

    const href = queryString ? `${resolvedPath}?${queryString}` : resolvedPath;

    let label = item.label;
    if (item.breadcrumbLabel && pageContext) {
      const recordKey = Object.keys(pageContext).find((key) => item.label.toLowerCase().includes(key.toLowerCase()));
      if (recordKey && pageContext[recordKey]) {
        label = item.breadcrumbLabel(pageContext[recordKey]);
      }
    }

    breadcrumbs.push({
      label,
      href,
    });
  }

  return breadcrumbs;
};
