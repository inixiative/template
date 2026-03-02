import { useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  authProviderReadMany,
  organizationReadAuthProvider,
  type AuthProviderReadManyResponses,
  type OrganizationReadAuthProviderResponses,
} from '@template/ui/apiClient';
import { apiQuery } from '@template/ui/lib';

type PlatformProvider = AuthProviderReadManyResponses[200]['data'][number];
type OrgProvider = OrganizationReadAuthProviderResponses[200]['data']['organization'][number];
export type AuthProvider = PlatformProvider | OrgProvider;

export const useAuthProviders = () => {
  const search = useSearch({ strict: false }) as { org?: string };
  const organizationId = search.org;

  const platformQuery = useQuery({
    queryKey: ['authProviders', 'platform'],
    queryFn: apiQuery((opts: Parameters<typeof authProviderReadMany>[0]) => authProviderReadMany(opts)),
    enabled: !organizationId,
    retry: 2,
  });

  const organizationQuery = useQuery({
    queryKey: ['authProviders', 'org', organizationId ?? ''],
    queryFn: apiQuery((opts: Parameters<typeof organizationReadAuthProvider>[0]) =>
      organizationReadAuthProvider({ ...opts, path: { id: organizationId! } })),
    enabled: !!organizationId,
    retry: 2,
  });

  const platformProviders: AuthProvider[] = platformQuery.data?.data ?? [];
  const organizationProviders: AuthProvider[] = organizationQuery.data?.data
    ? [...organizationQuery.data.data.platform, ...organizationQuery.data.data.organization]
    : [];

  return {
    providers: organizationId ? organizationProviders : platformProviders,
    isLoading: platformQuery.isLoading || organizationQuery.isLoading,
    error: platformQuery.error ?? organizationQuery.error,
  };
};
