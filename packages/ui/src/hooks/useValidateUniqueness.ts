import { organizationRead, spaceRead } from '@template/ui/apiClient';
import { useQuery } from '@template/ui/hooks/useQuery';
import { apiFetchInternal } from '@template/ui/lib/apiFetchInternal';
import { useAppStore } from '@template/ui/store';

type Model = 'organization' | 'space';

type LookupOptions = { path: { id: string }; query?: { lookup?: string } };
type LookupReader = (options: LookupOptions & Record<string, unknown>) => Promise<unknown>;

const modelReaders: Record<Model, LookupReader> = {
  organization: organizationRead as LookupReader,
  space: spaceRead as LookupReader,
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
    queryFn: async () => {
      if (!value) return { available: true, existingId: undefined };

      const { auth } = useAppStore.getState();
      const reader = modelReaders[model];
      const params: LookupOptions =
        !field || field === 'id' ? { path: { id: value } } : { path: { id: value }, query: { lookup: field } };

      // Use throwOnError: false so we can inspect response.status
      // (throwOnError: true throws the parsed JSON body which has no .status field)
      const result = (await apiFetchInternal(
        (requestOptions: LookupOptions) => reader({ ...params, ...requestOptions }),
        { spoofUserEmail: auth.spoofUserEmail, throwOnError: false },
      )()) as { response?: { status: number }; error?: unknown; data?: { data?: { id: string } } | { id: string } };

      if (result?.response?.status === 404) {
        return { available: true, existingId: undefined };
      }

      if (result?.error) {
        throw result.error;
      }

      const raw = result?.data;
      const record = raw ? ('data' in raw ? raw.data : (raw as { id: string })) : undefined;
      const isTaken = record && (!options?.excludeId || record.id !== options.excludeId);

      return {
        available: !isTaken,
        existingId: record?.id,
      };
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
