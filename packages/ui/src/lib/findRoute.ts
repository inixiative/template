import type { NavConfig, NavItem } from '@template/ui/components/layout/navigationTypes';

export type RouteMatch = {
  item: NavItem;
  chain: NavItem[];
  fullPath: string;
  params: Record<string, string>;
};

const CONTEXT_FALLBACK_ORDER = ['space', 'organization', 'user', 'public'] as const;

function matchSegment(pattern: string, segment: string): Record<string, string> | null {
  if (pattern === segment) return {};

  if (pattern.startsWith(':')) {
    const paramName = pattern.slice(1);
    return { [paramName]: segment };
  }

  return null;
}

function isPathPrefix(patternSegments: string[], targetSegments: string[]): Record<string, string> | null {
  if (patternSegments.length > targetSegments.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternSegments.length; i++) {
    const match = matchSegment(patternSegments[i], targetSegments[i]);
    if (match === null) return null;
    Object.assign(params, match);
  }
  return params;
}

function searchNavItems(
  items: NavItem[],
  targetPath: string,
  currentChain: NavItem[] = [],
  currentPath = '',
  depth = 0,
): RouteMatch | null {
  if (depth > 10) return null;

  const targetSegments = targetPath.split('/').filter(Boolean);

  for (const item of items) {
    if (item.path?.includes(':')) continue;

    const fullPath = currentPath + (item.path || '');
    const chain = [...currentChain, item];

    if (fullPath === targetPath) {
      return { item, chain, fullPath, params: {} };
    }

    if (targetPath.startsWith(`${fullPath}/`) && item.items) {
      const match = searchNavItems(item.items, targetPath, chain, fullPath, depth + 1);
      if (match) return match;
    }
  }

  for (const item of items) {
    const fullPath = currentPath + (item.path || '');
    const chain = [...currentChain, item];
    const patternSegments = fullPath.split('/').filter(Boolean);
    const params = isPathPrefix(patternSegments, targetSegments);
    if (params === null) continue;

    if (patternSegments.length === targetSegments.length) {
      return { item, chain, fullPath, params };
    }

    if (item.items) {
      const match = searchNavItems(item.items, targetPath, chain, fullPath, depth + 1);
      if (match) return match;
    }
  }

  return null;
}

export const findRoute = (
  path: string,
  navConfig: NavConfig,
  contextType: 'user' | 'organization' | 'space' | 'public',
): RouteMatch | null => {
  const items = navConfig[contextType] || [];
  return searchNavItems(items, path);
};

export const findRouteAcrossContexts = (
  path: string,
  navConfig: NavConfig,
  currentContext: 'user' | 'organization' | 'space' | 'public',
): { match: RouteMatch; contextType: (typeof CONTEXT_FALLBACK_ORDER)[number] } | null => {
  const startIndex = CONTEXT_FALLBACK_ORDER.indexOf(currentContext);
  const searchOrder = CONTEXT_FALLBACK_ORDER.slice(startIndex);

  for (const contextType of searchOrder) {
    const match = findRoute(path, navConfig, contextType);
    if (match) return { match, contextType };
  }

  return null;
};
