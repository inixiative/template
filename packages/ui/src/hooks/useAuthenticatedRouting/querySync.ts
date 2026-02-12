import type { SearchInput } from '@template/ui/lib/searchParams';
import { readSearchParam } from '@template/ui/lib/searchParams';
import type { AppStore } from '@template/ui/store/types';
import type { RoutingSearchParams } from '@template/ui/hooks/useAuthenticatedRouting/types';

export type SyncStoreFromSearchParamsInput = {
  searchParams: RoutingSearchParams;
  tenant: AppStore['tenant'];
  auth: AppStore['auth'];
};

export const parseRoutingSearchParams = (search: SearchInput): RoutingSearchParams => {
  return {
    organizationId: readSearchParam(search, 'org'),
    spaceId: readSearchParam(search, 'space'),
    spoofEmail: readSearchParam(search, 'spoof'),
  };
};

export const syncStoreFromSearchParams = ({ searchParams, tenant, auth }: SyncStoreFromSearchParamsInput): void => {
  if (searchParams.spaceId && tenant.context.space?.id !== searchParams.spaceId) {
    tenant.setSpace(searchParams.spaceId);
  } else if (searchParams.organizationId && tenant.context.organization?.id !== searchParams.organizationId) {
    tenant.setOrganization(searchParams.organizationId);
  }
};
