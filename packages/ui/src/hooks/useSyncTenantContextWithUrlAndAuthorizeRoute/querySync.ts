/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui
 * @uses none
 */
import type { RoutingSearchParams } from '@template/ui/hooks/useSyncTenantContextWithUrlAndAuthorizeRoute/types';
import type { SearchInput } from '@template/ui/lib/searchParams';
import { searchParamValue } from '@template/ui/lib/searchParams';
import type { AppStore } from '@template/ui/store/types';

export type SyncStoreFromSearchParamsInput = {
  searchParams: RoutingSearchParams;
  tenant: AppStore['tenant'];
  auth: AppStore['auth'];
};

export const parseRoutingSearchParams = (search: SearchInput): RoutingSearchParams => {
  return {
    organizationId: searchParamValue(search, 'org'),
    spaceId: searchParamValue(search, 'space'),
    spoofEmail: searchParamValue(search, 'spoof'),
    flowId: searchParamValue(search, 'flow'),
  };
};

export const syncStoreFromSearchParams = ({
  searchParams,
  tenant,
  auth: _auth,
}: SyncStoreFromSearchParamsInput): void => {
  if (searchParams.spaceId && tenant.context.space?.id !== searchParams.spaceId) {
    tenant.switchToSpaceContext(searchParams.spaceId);
  } else if (
    searchParams.organizationId &&
    tenant.context.organization?.id !== searchParams.organizationId
  ) {
    tenant.switchToOrganizationContext(searchParams.organizationId);
  }
};
