import type { TenantContext } from '@template/ui/store/types/tenant';
import type { RoutingSearchParams, UrlSearchParamUpdates } from '@template/ui/hooks/useAuthenticatedRouting/types';

export type BuildSearchParamUpdatesInput = {
  searchParams: RoutingSearchParams;
  context: TenantContext;
  spoofUserEmail: string | null;
};

export const buildSearchParamUpdates = ({
  searchParams,
  context,
  spoofUserEmail,
}: BuildSearchParamUpdatesInput): UrlSearchParamUpdates | null => {
  const updates: UrlSearchParamUpdates = {};
  if (spoofUserEmail !== searchParams.spoofEmail) updates.spoof = spoofUserEmail;

  if (context.type === 'space' && context.space?.id !== searchParams.spaceId) {
    updates.space = context.space!.id;
    updates.org = null;
  } else if (context.type === 'organization' && context.organization?.id !== searchParams.organizationId) {
    updates.org = context.organization!.id;
    updates.space = null;
  } else if ((context.type === 'user' || context.type === 'public') && (searchParams.organizationId || searchParams.spaceId)) {
    updates.org = null;
    updates.space = null;
  }

  if (!Object.keys(updates).length) return null;
  return updates;
};

export const replaceUrlSearchParams = (updates: UrlSearchParamUpdates): void => {
  const url = new URL(window.location.href);

  Object.entries(updates).forEach(([key, value]) => {
    if (value != null) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  });

  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
};
