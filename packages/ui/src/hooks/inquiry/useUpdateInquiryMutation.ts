import type { QueryKey } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { inquiryUpdate } from '@template/ui/apiClient';
import { apiMutation } from '@template/ui/lib/apiMutation';
import type { InquiryMeta } from '@template/ui/lib/inquiryQueryKeys';
import { sourceMutations } from '@template/ui/lib/inquiryQueryKeys';
import { useMutation } from '@template/ui/hooks/useQuery';
import { useInquirySendEffects } from '@template/ui/hooks/inquiry/useInquirySendEffects';

type UpdateVars = {
  inquiry: InquiryMeta;
  body: { content?: Record<string, unknown>; status?: 'draft' | 'sent' };
};

type UpdateContext = { snapshots: [QueryKey, unknown][] };

export const useUpdateInquiryMutation = () => {
  const queryClient = useQueryClient();
  const applySendEffects = useInquirySendEffects();

  return useMutation<unknown, Error, UpdateVars, UpdateContext>({
    mutationFn: apiMutation(({ inquiry, body }: UpdateVars) =>
      inquiryUpdate({ path: { id: inquiry.id }, body }),
    ),

    onMutate: async ({ inquiry, body }) => {
      const keys = sourceMutations[inquiry.type](inquiry);
      const snapshots: [QueryKey, unknown][] = [];

      for (const key of keys) {
        await queryClient.cancelQueries({ queryKey: key });
        snapshots.push([key, queryClient.getQueryData(key)]);
        queryClient.setQueryData(key, (old: { data?: { id: string }[] } | undefined) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((inq) => (inq.id === inquiry.id ? { ...inq, ...body } : inq)),
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

    onSettled: async (_data, _err, { inquiry }) => {
      await applySendEffects(inquiry, 'update');
    },
  });
};
