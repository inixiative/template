import type { QueryKey } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useInquirySendEffects } from '@template/ui/hooks/inquiry/useInquirySendEffects';
import { useMutation } from '@template/ui/hooks/useQuery';
import type { InquiryMeta } from '@template/ui/lib/inquiryQueryKeys';
import { sourceMutations } from '@template/ui/lib/inquiryQueryKeys';

type CreateVars = {
  inquiry: Omit<InquiryMeta, 'id'>;
  call: () => Promise<unknown>;
  optimisticItem: Record<string, unknown>;
};

type CreateContext = { snapshots: [QueryKey, unknown][] };

export const useCreateInquiryMutation = () => {
  const queryClient = useQueryClient();
  const applySendEffects = useInquirySendEffects();

  return useMutation<unknown, Error, CreateVars, CreateContext>({
    mutationFn: ({ call }) => call(),

    onMutate: async ({ inquiry, optimisticItem }) => {
      const meta = { ...inquiry, id: '__optimistic__' } as InquiryMeta;
      const keys = sourceMutations[inquiry.type](meta);
      const snapshots: [QueryKey, unknown][] = [];

      for (const key of keys) {
        await queryClient.cancelQueries({ queryKey: key });
        snapshots.push([key, queryClient.getQueryData(key)]);
        queryClient.setQueryData(key, (old: { data?: unknown[] } | undefined) => {
          if (!old?.data) return old;
          return { ...old, data: [...old.data, { id: '__optimistic__', ...optimisticItem }] };
        });
      }

      return { snapshots };
    },

    onError: (_err, _vars, context) => {
      for (const [key, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(key, data);
      }
    },

    onSettled: async (_data, _err, { inquiry }) => {
      await applySendEffects({ ...inquiry, id: '__optimistic__' } as InquiryMeta, 'create');
    },
  });
};
