import type { NavConfig, NavItem } from '@template/ui';

export type RouteMatch = {
  item: NavItem;
  chain: NavItem[]; // Root to matched item
  fullPath: string; // Built path from concatenated segments
  params: Record<string, string>; // Extracted :id values
};

const CONTEXT_FALLBACK_ORDER = ['space', 'organization', 'personal', 'public'] as const;

/**
 * Match a path segment against a pattern, handling path variables like :id
 * Returns null if no match, or an object with extracted params
 */
function matchSegment(pattern: string, segment: string): Record<string, string> | null {
  // Exact match
  if (pattern === segment) return {};

  // Path variable match (e.g., :id, :slug)
  if (pattern.startsWith(':')) {
    const paramName = pattern.slice(1);
    return { [paramName]: segment };
  }

  return null;
}

/**
 * Check if a full path matches a pattern path, extracting params
 * Pattern: /events/:id/edit
 * Path: /events/abc123/edit
 * Returns: { id: 'abc123' } or null if no match
 */
function matchPath(
  patternSegments: string[],
  pathSegments: string[],
): Record<string, string> | null {
  if (patternSegments.length !== pathSegments.length) return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < patternSegments.length; i++) {
    const segmentMatch = matchSegment(patternSegments[i], pathSegments[i]);
    if (segmentMatch === null) return null;
    Object.assign(params, segmentMatch);
  }

  return params;
}

/**
 * Check if a pattern path is a prefix of the target (for recursion with params)
 */
function isPathPrefix(
  patternSegments: string[],
  targetSegments: string[],
): Record<string, string> | null {
  if (patternSegments.length > targetSegments.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternSegments.length; i++) {
    const match = matchSegment(patternSegments[i], targetSegments[i]);
    if (match === null) return null;
    Object.assign(params, match);
  }
  return params;
}

/**
 * Recursively search nav tree for a matching route.
 * At each level: scan for exact matches first, then param matches.
 * Includes depth limit to prevent stack overflow from malformed configs.
 */
function searchNavItems(
  items: NavItem[],
  targetPath: string,
  currentChain: NavItem[] = [],
  currentPath = '',
  depth = 0,
): RouteMatch | null {
  // Prevent stack overflow from circular references or excessive nesting
  if (depth > 10) return null;

  const targetSegments = targetPath.split('/').filter(Boolean);

  // First pass: exact matches (no params)
  for (const item of items) {
    if (item.path?.includes(':')) continue; // Skip params in first pass

    const fullPath = currentPath + (item.path || '');
    const chain = [...currentChain, item];

    // Exact match - we're done
    if (fullPath === targetPath) {
      return { item, chain, fullPath, params: {} };
    }

    // Prefix match - recurse into children
    if (targetPath.startsWith(fullPath + '/') && item.items) {
      const match = searchNavItems(item.items, targetPath, chain, fullPath, depth + 1);
      if (match) return match;
    }
  }

  // Second pass: param matches
  for (const item of items) {
    const fullPath = currentPath + (item.path || '');
    const chain = [...currentChain, item];
    const patternSegments = fullPath.split('/').filter(Boolean);

    // Check if this pattern matches or is a prefix of target
    const params = isPathPrefix(patternSegments, targetSegments);
    if (params === null) continue;

    // Full match - we're done
    if (patternSegments.length === targetSegments.length) {
      return { item, chain, fullPath, params };
    }

    // Prefix match - recurse into children
    if (item.items) {
      const match = searchNavItems(item.items, targetPath, chain, fullPath, depth + 1);
      if (match) return match;
    }
  }

  return null;
}

/**
 * Find a route in the nav config for a given path and context.
 * Returns the matched nav item, full chain from root, built path, and extracted params.
 *
 * Example:
 * ```typescript
 * const match = findRoute('/events/abc123', navConfig, 'organization');
 * // Returns:
 * // {
 * //   item: { label: 'Event', path: '/:id', ... },
 * //   chain: [{ label: 'Events', path: '/events' }, { label: 'Event', path: '/:id' }],
 * //   fullPath: '/events/:id',
 * //   params: { id: 'abc123' }
 * // }
 * ```
 */
export const findRoute = (
  path: string,
  navConfig: NavConfig,
  contextType: 'personal' | 'organization' | 'space' | 'public',
): RouteMatch | null => {
  const items = navConfig[contextType] || [];
  return searchNavItems(items, path);
};

/**
 * Find a route across context types, starting from current context and following fallback chain.
 * Fallback order: space → organization → personal → public
 *
 * Example:
 * - Current: 'organization' → searches: organization, personal, public
 * - Current: 'space' → searches: space, organization, personal, public
 */
export const findRouteAcrossContexts = (
  path: string,
  navConfig: NavConfig,
  currentContext: 'personal' | 'organization' | 'space' | 'public',
): { match: RouteMatch; contextType: typeof CONTEXT_FALLBACK_ORDER[number] } | null => {
  const startIndex = CONTEXT_FALLBACK_ORDER.indexOf(currentContext);
  const searchOrder = CONTEXT_FALLBACK_ORDER.slice(startIndex);

  for (const contextType of searchOrder) {
    const match = findRoute(path, navConfig, contextType);
    if (match) return { match, contextType };
  }

  return null;
};
