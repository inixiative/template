/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui
 * @uses none
 */
import type {
  RoutingSearchParams,
  UrlSearchParamUpdates,
} from '@template/ui/hooks/useAuthenticatedRouting/types';
import { type SearchInput, toUrlSearchParams } from '@template/ui/lib/searchParams';
import type { TenantContext } from '@template/ui/store/types/tenant';

export type BuildSearchParamUpdatesInput = {
  searchParams: RoutingSearchParams;
  context: TenantContext;
  spoofUserEmail: string | null;
  flowId: string | null;
  isKnownOrganization: (organizationId: string) => boolean;
  isKnownSpace: (spaceId: string) => boolean;
};

export const buildSearchParamUpdates = ({
  searchParams,
  context,
  spoofUserEmail,
  flowId,
  isKnownOrganization,
  isKnownSpace,
}: BuildSearchParamUpdatesInput): UrlSearchParamUpdates | null => {
  const updates: UrlSearchParamUpdates = {};
  if (spoofUserEmail !== searchParams.spoofEmail) updates.spoof = spoofUserEmail;
  if (flowId !== searchParams.flowId) updates.flow = flowId;

  if (context.type === 'space' && context.space?.id !== searchParams.spaceId) {
    updates.space = context.space!.id;
    updates.org = null;
  } else if (
    context.type === 'organization' &&
    context.organization?.id !== searchParams.organizationId
  ) {
    updates.org = context.organization!.id;
    updates.space = null;
  } else if (context.type === 'user' || context.type === 'public') {
    if (searchParams.organizationId && isKnownOrganization(searchParams.organizationId))
      updates.org = null;
    if (searchParams.spaceId && isKnownSpace(searchParams.spaceId)) updates.space = null;
  }

  if (!Object.keys(updates).length) return null;
  return updates;
};

export const applySearchParamUpdates = (
  search: SearchInput,
  updates: UrlSearchParamUpdates,
): Record<string, string> => {
  const params = toUrlSearchParams(search);
  Object.entries(updates).forEach(([key, value]) => {
    if (value != null) params.set(key, value);
    else params.delete(key);
  });
  return Object.fromEntries(params);
};
