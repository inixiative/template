import type { QueryKey } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { inquiryDelete } from '@template/ui/apiClient';
import { apiMutation } from '@template/ui/lib/apiMutation';
import type { InquiryMeta } from '@template/ui/lib/inquiryQueryKeys';
import { sourceMutations } from '@template/ui/lib/inquiryQueryKeys';
import { useMutation } from '@template/ui/hooks/useQuery';
import { useInquirySendEffects } from '@template/ui/hooks/inquiry/useInquirySendEffects';

type CancelContext = { snapshots: [QueryKey, unknown][] };

export const useCancelInquiryMutation = () => {
  const queryClient = useQueryClient();
  const applySendEffects = useInquirySendEffects();

  return useMutation<unknown, Error, InquiryMeta, CancelContext>({
    mutationFn: apiMutation((inquiry: InquiryMeta) =>
      inquiryDelete({ path: { id: inquiry.id } }),
    ),

    onMutate: async (inquiry) => {
      const keys = sourceMutations[inquiry.type](inquiry);
      const snapshots: [QueryKey, unknown][] = [];

      for (const key of keys) {
        await queryClient.cancelQueries({ queryKey: key });
        snapshots.push([key, queryClient.getQueryData(key)]);
        queryClient.setQueryData(key, (old: { data?: { id: string }[] } | undefined) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((inq) => (inq.id === inquiry.id ? { ...inq, status: 'canceled' } : inq)),
          };
        });
      }

      return { snapshots };
    },

    onError: (_err, _vars, context) => {
      for (const [key, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(key, data);
      }
    },

    onSettled: async (_data, _err, inquiry) => {
      await applySendEffects(inquiry, 'cancel');
    },
  });
};
