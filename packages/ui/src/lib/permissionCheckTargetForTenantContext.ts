/**
 * @atlas
 * @kind utils
 * @partOf primitive:ui
 * @uses primitive:authz
 */
import type { AccessorName, HydratedRecord } from '@template/db';
import { hydrateSpaceForPermissions } from '@template/ui/lib/hydrateRecordForPermissions';
import { useAppStore } from '@template/ui/store';
import type { TenantContext } from '@template/ui/store/types/tenant';

export const permissionCheckTargetForTenantContext = (
  context: TenantContext,
): readonly [AccessorName, HydratedRecord] => {
  const { auth } = useAppStore.getState();
  if (context.type === 'organization' && context.organization) {
    return ['organization', context.organization as unknown as HydratedRecord];
  }
  if (context.type === 'space' && context.space) {
    return [
      'space',
      hydrateSpaceForPermissions(
        context.space as unknown as Record<string, unknown>,
        auth,
        context,
      ),
    ];
  }
  if (context.type === 'user') {
    return ['user', (auth.user ?? {}) as HydratedRecord];
  }
  return ['user', {} as HydratedRecord];
};
