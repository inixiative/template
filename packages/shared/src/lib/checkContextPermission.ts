import type { NavConfig } from '@template/ui';
import type { AuthSlice } from '../store/slices/auth';
import type { PermissionsSlice } from '../store';
import type { TenantContext } from '../store/slices/tenant';
import { findRoute } from './findRoute';

export type { NavConfig };

export type ContextPermissionCheck = {
  path: string;
  permissions: PermissionsSlice['permissions'];
  currentContext: TenantContext;
  organizations?: AuthSlice['auth']['organizations'];
  navConfig: NavConfig;
};

/**
 * Determines if the current context has access to a page.
 * Uses nav config as single source of truth for route permissions.
 * Falls back through contexts: space → org → personal → public
 * Returns the valid context or null if no access.
 */
export const checkContextPermission = ({
  path,
  permissions,
  currentContext,
  organizations,
  navConfig,
}: ContextPermissionCheck): TenantContext | null => {
  // Build fallback contexts
  const fallbacks: TenantContext[] = [currentContext];

  if (currentContext.type === 'space' && currentContext.space?.organizationId) {
    const org = organizations?.find((o) => o.id === currentContext.space?.organizationId);
    if (org) {
      fallbacks.push({
        type: 'organization',
        organization: org,
        space: undefined,
        personal: undefined,
      });
    }
  }

  fallbacks.push({
    type: 'personal',
    organization: undefined,
    space: undefined,
    personal: currentContext.personal,
  });

  fallbacks.push({
    type: 'public',
    organization: undefined,
    space: undefined,
    personal: undefined,
  });

  // Try each fallback context
  for (const ctx of fallbacks) {
    // Find route in this context's nav
    const match = findRoute(path, navConfig, ctx.type);
    if (!match) continue; // Route doesn't exist in this context

    // No access function = page is accessible in this context
    if (!match.item.access) return ctx;

    // Check access for this context
    if (match.item.access(permissions, ctx)) return ctx;
  }

  return null;
};
