import { useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  authProviderReadMany,
  organizationReadAuthProvider,
  type AuthProviderReadManyResponses,
  type OrganizationReadAuthProviderResponses,
} from '@template/ui/apiClient';
import { apiQuery } from '@template/ui/lib';

type PlatformProvider = AuthProviderReadManyResponses[200]['data'][0];
type OrgProvider = OrganizationReadAuthProviderResponses[200]['data']['organization'][0];
export type AuthProvider = PlatformProvider | OrgProvider;

export const useAuthProviders = () => {
  const search = useSearch({ strict: false }) as { org?: string };

  const { data, isLoading, error } = useQuery({
    queryKey: search.org ? ['authProviders', 'org', search.org] : ['authProviders', 'platform'],
    queryFn: search.org
      ? apiQuery((opts: Parameters<typeof organizationReadAuthProvider>[0]) =>
          organizationReadAuthProvider({ ...opts, path: { id: search.org! } }))
      : apiQuery((opts: Parameters<typeof authProviderReadMany>[0]) => authProviderReadMany(opts)),
    retry: 2,
  });

  const providers = search.org && data?.platform && data?.organization
    ? [...data.platform, ...data.organization]
    : data ?? [];

  return { providers, isLoading, error };
};
