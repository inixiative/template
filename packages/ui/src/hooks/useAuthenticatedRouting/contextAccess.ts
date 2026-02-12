import { checkContextPermission } from '@template/ui/lib/checkContextPermission';
import type { AppStore } from '@template/ui/store/types';
import type { TenantContext } from '@template/ui/store/types/tenant';
import type { RoutingContextResolutionInput } from '@template/ui/hooks/useAuthenticatedRouting/types';

export type ApplyAuthorizedContextInput = {
  tenant: AppStore['tenant'];
  context: TenantContext;
};

export const resolveAuthorizedContext = (input: RoutingContextResolutionInput): TenantContext | null => {
  return checkContextPermission({
    path: input.path,
    navConfig: input.navConfig,
    permissions: input.permissions,
    context: input.context,
    page: input.page,
    organizations: input.organizations,
  });
};

export const hasContextChanged = (context: TenantContext, nextContext: TenantContext): boolean => {
  return (
    context.type !== nextContext.type ||
    context.space?.id !== nextContext.space?.id ||
    context.organization?.id !== nextContext.organization?.id
  );
};

export const applyAuthorizedContext = ({ tenant, context }: ApplyAuthorizedContextInput): void => {
  if (context.type === 'organization' && context.organization) {
    tenant.setOrganization(context.organization.id);
    return;
  }

  if (context.type === 'space' && context.space) {
    tenant.setSpace(context.space.id);
    return;
  }

  if (context.type === 'user') {
    tenant.setUser();
    return;
  }

  if (context.type === 'public') {
    tenant.setPublic();
  }
};
