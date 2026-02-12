import type { NavConfig } from '@template/ui/components/layout/navigationTypes';
import { findRoute } from '@template/ui/lib/findRoute';
import type { AuthSlice } from '@template/ui/store/types/auth';
import type { PermissionsSlice } from '@template/ui/store/types/permissions';
import type { PageContext, TenantContext } from '@template/ui/store/types/tenant';

export type ContextPermissionCheck = {
  path: string;
  permissions: PermissionsSlice['permissions'];
  context: TenantContext;
  page: PageContext;
  organizations?: AuthSlice['auth']['organizations'];
  navConfig: NavConfig;
};

export const checkContextPermission = ({
  path,
  navConfig,
  permissions,
  context,
  page,
  organizations,
}: ContextPermissionCheck): TenantContext | null => {
  const fallbacks: TenantContext[] = [context];

  if (context.type === 'space' && context.space?.organizationId && organizations) {
    const org = organizations[context.space.organizationId];
    if (org) {
      fallbacks.push({ type: 'organization', organization: org });
    }
  }

  if (context.type !== 'user') {
    fallbacks.push({ type: 'user' });
  }

  if (context.type !== 'public') {
    fallbacks.push({ type: 'public' });
  }

  for (const ctx of fallbacks) {
    const match = findRoute(path, navConfig, ctx.type);
    if (!match) continue;

    if (!match.item.access) return ctx;

    if (match.item.access(permissions, ctx, page)) return ctx;
  }

  return null;
};
