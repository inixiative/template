import type { AppStore } from '@template/ui/store/types';
import type { TenantContext } from '@template/ui/store/types/tenant';

export const hasContextChanged = (context: TenantContext, nextContext: TenantContext): boolean => {
  return (
    context.type !== nextContext.type ||
    context.space?.id !== nextContext.space?.id ||
    context.organization?.id !== nextContext.organization?.id
  );
};

export const applyAuthorizedContext = ({
  tenant,
  context,
}: { tenant: AppStore['tenant']; context: TenantContext }): void => {
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
