import { organizationRead, spaceRead } from '@template/ui/apiClient';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { useQuery } from '@template/ui/hooks/useQuery';

type Model = 'organization' | 'space';

const modelReaders = {
  organization: organizationRead,
  space: spaceRead,
};

export const useValidateUniqueness = (
  model: Model,
  field: string,
  value: string,
  options?: {
    enabled?: boolean;
    excludeId?: string;
  },
) => {
  const enabled = options?.enabled ?? true;

  const { data, isLoading, error } = useQuery({
    queryKey: ['validate-uniqueness', model, field, value],
    queryFn: async (context) => {
      if (!value) return { available: true, existingId: undefined };

      try {
        const reader = modelReaders[model];
        type ReaderOptions = Parameters<typeof reader>[0];
        const params =
          !field || field === 'id'
            ? { path: { id: value } }
            : ({ path: { id: value }, query: { lookup: field } } as ReaderOptions);
        const result = await apiQuery(
          (requestOptions: ReaderOptions) => reader({ ...params, ...requestOptions }),
        )(context);

        const isTaken = result.data && (!options?.excludeId || result.data.id !== options.excludeId);

        return {
          available: !isTaken,
          existingId: result.data?.id,
        };
      } catch (err: any) {
        if (err?.status === 404 || err?.response?.status === 404) {
          return { available: true, existingId: undefined };
        }
        throw err;
      }
    },
    enabled: enabled && !!value && value.length > 0,
    staleTime: 1000 * 5,
    retry: false,
  });

  return {
    isAvailable: data?.available ?? true,
    isChecking: isLoading,
    existingId: data?.existingId,
    error,
  };
};
