import type { AccessorName, HydratedRecord } from '@template/db';
import { useAppStore } from '@template/ui/store';
import type { TenantContext } from '@template/ui/store/types/tenant';

/**
 * Extracts the appropriate model and resource ID for permission checks from tenant context.
 * Returns a tuple compatible with permissions.check(model, record, action).
 * Public context has no record, so it falls back to an empty object.
 * User context uses auth.user from store as source of truth.
 */
export const getContextParams = (
  context: TenantContext,
): readonly [AccessorName, HydratedRecord] => {
  if (context.type === 'organization' && context.organization) {
    return ['organization', context.organization as unknown as HydratedRecord];
  }
  if (context.type === 'space' && context.space) {
    return ['space', context.space as unknown as HydratedRecord];
  }
  if (context.type === 'user') {
    const user = useAppStore.getState().auth.user;
    return ['user', (user ?? {}) as HydratedRecord];
  }
  return ['user', {} as HydratedRecord];
};
