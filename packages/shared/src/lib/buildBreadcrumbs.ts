import type { RouteMatch } from './findRoute';
import type { TenantContext } from '../store/slices/tenant';

export type Breadcrumb = {
  label: string;
  href: string; // Full URL with context query params
};

/**
 * Build breadcrumbs from a route match, context, and page data.
 * Includes context query params in links and uses breadcrumbLabel functions for dynamic segments.
 *
 * Example:
 * ```typescript
 * const match = findRoute('/events/abc123/edit', navConfig, 'organization');
 * const breadcrumbs = buildBreadcrumbs(match, context, {
 *   event: { id: 'abc123', name: 'Tech Conference' }
 * });
 * // Returns:
 * // [
 * //   { label: 'Events', href: '/events?org=org-123' },
 * //   { label: 'Tech Conference', href: '/events/abc123?org=org-123' },
 * //   { label: 'Edit', href: '/events/abc123/edit?org=org-123' }
 * // ]
 * ```
 */
export const buildBreadcrumbs = (
  match: RouteMatch,
  context: TenantContext,
  pageContext?: Record<string, any>,
): Breadcrumb[] => {
  const breadcrumbs: Breadcrumb[] = [];
  let currentPath = '';

  // Build context query params
  const contextParams = new URLSearchParams();
  if (context.type === 'organization' && context.organization) {
    contextParams.set('org', context.organization.id);
  } else if (context.type === 'space' && context.space) {
    contextParams.set('space', context.space.id);
  }
  const queryString = contextParams.toString();

  for (let i = 0; i < match.chain.length; i++) {
    const item = match.chain[i];
    const segment = item.path || '';

    // Build path by concatenating segments
    currentPath += segment;

    // Replace :params with actual values in the path
    let resolvedPath = currentPath;
    for (const [key, value] of Object.entries(match.params)) {
      resolvedPath = resolvedPath.replace(`:${key}`, value);
    }

    // Add context query params
    const href = queryString ? `${resolvedPath}?${queryString}` : resolvedPath;

    // Get label - use breadcrumbLabel function if available, otherwise use static label
    let label = item.label;
    if (item.breadcrumbLabel && pageContext) {
      // Try to find the record in pageContext by convention
      // e.g., for /events/:id, look for pageContext.event
      const recordKey = Object.keys(pageContext).find((key) =>
        item.label.toLowerCase().includes(key.toLowerCase()),
      );
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
