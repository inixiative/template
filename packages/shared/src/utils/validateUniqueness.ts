import { useQuery } from '@tanstack/react-query';
import { organizationRead, spaceRead } from '../apiClient';

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
  }
) => {
  const enabled = options?.enabled ?? true;

  const { data, isLoading, error } = useQuery({
    queryKey: ['validate-uniqueness', model, field, value],
    queryFn: async () => {
      if (!value) return { available: true };

      try {
        const reader = modelReaders[model];
        const result = await reader({
          path: { id: value },
          query: { lookup: field } as any,
        });

        const isTaken = result.data && (!options?.excludeId || (result.data as any).id !== options.excludeId);

        return {
          available: !isTaken,
          existingId: (result.data as any)?.id,
        };
      } catch (err: any) {
        if (err?.status === 404 || err?.response?.status === 404) {
          return { available: true };
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
