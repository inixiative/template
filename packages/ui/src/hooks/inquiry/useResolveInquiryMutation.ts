import type { QueryKey } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { inquiryResolve } from '@template/ui/apiClient';
import { useInquiryResolutionEffects } from '@template/ui/hooks/inquiry/useInquiryResolutionEffects';
import { useMutation } from '@template/ui/hooks/useQuery';
import { apiMutation } from '@template/ui/lib/apiMutation';
import type { InquiryMeta } from '@template/ui/lib/inquiryQueryKeys';
import { targetMutations } from '@template/ui/lib/inquiryQueryKeys';

type ResolveVars = {
  inquiry: InquiryMeta;
  status: 'approved' | 'denied' | 'changesRequested';
};

type ResolveContext = { snapshots: [QueryKey, unknown][] };

export const useResolveInquiryMutation = () => {
  const queryClient = useQueryClient();
  const applyResolutionEffects = useInquiryResolutionEffects();

  return useMutation<unknown, Error, ResolveVars, ResolveContext>({
    mutationFn: apiMutation(({ inquiry, status }: ResolveVars) =>
      inquiryResolve({ path: { id: inquiry.id }, body: { status } }),
    ),

    onMutate: async ({ inquiry, status }) => {
      const keys = targetMutations[inquiry.type](inquiry);
      const snapshots: [QueryKey, unknown][] = [];

      for (const key of keys) {
        await queryClient.cancelQueries({ queryKey: key });
        snapshots.push([key, queryClient.getQueryData(key)]);
        queryClient.setQueryData(key, (old: { data?: { id: string }[] } | undefined) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((inq) => (inq.id === inquiry.id ? { ...inq, status } : inq)),
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

    onSettled: async (_data, _err, { inquiry, status }) => {
      await applyResolutionEffects(inquiry, status);
    },
  });
};
