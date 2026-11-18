/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui
 * @uses none
 */
import type { AppStore } from '@template/ui/store/types';
import type { TenantContext } from '@template/ui/store/types/tenant';

export const hasContextChanged = (context: TenantContext, nextContext: TenantContext): boolean => {
  return (
    context.type !== nextContext.type ||
    context.space?.id !== nextContext.space?.id ||
    context.organization?.id !== nextContext.organization?.id
  );
};

export const setTenantContextInStore = ({
  tenant,
  context,
}: {
  tenant: AppStore['tenant'];
  context: TenantContext;
}): void => {
  if (context.type === 'organization' && context.organization) {
    tenant.switchToOrganizationContext(context.organization.id);
    return;
  }

  if (context.type === 'space' && context.space) {
    tenant.switchToSpaceContext(context.space.id);
    return;
  }

  if (context.type === 'user') {
    tenant.switchToUserContext();
    return;
  }

  if (context.type === 'public') {
    tenant.switchToPublicContext();
  }
};
