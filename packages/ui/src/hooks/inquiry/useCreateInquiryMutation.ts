import { useOptimisticMutation } from '@template/ui/hooks/useOptimisticMutation';
import type { InquiryMeta } from '@template/ui/lib/inquiries/queryKeys';
import { sourceMutations } from '@template/ui/lib/inquiries/queryKeys';

type CreateVars = {
  inquiry: Omit<InquiryMeta, 'id'>;
  call: () => Promise<unknown>;
  optimisticItem: Record<string, unknown>;
};

export const useCreateInquiryMutation = () => {
  return useOptimisticMutation<unknown, Error, CreateVars>({
    mutationFn: ({ call }) => call(),
    targets: ({ inquiry, optimisticItem }) => {
      const meta = { ...inquiry, id: '__optimistic__' } as InquiryMeta;
      return sourceMutations[inquiry.type](meta).map((queryKey) => ({
        queryKey,
        optimisticUpdate: (old: unknown) => {
          const cached = old as { data?: unknown[] } | undefined;
          if (!cached?.data) return cached;
          return { ...cached, data: [...cached.data, { id: '__optimistic__', ...optimisticItem }] };
        },
      }));
    },
  });
};
