import { inquiryResolve } from '@template/ui/apiClient';
import { useInquiryResolutionEffects } from '@template/ui/hooks/inquiry/useInquiryResolutionEffects';
import { useOptimisticMutation } from '@template/ui/hooks/useOptimisticMutation';
import { apiMutation } from '@template/ui/lib/apiMutation';
import type { InquiryMeta } from '@template/ui/lib/inquiryQueryKeys';
import { targetMutations } from '@template/ui/lib/inquiryQueryKeys';

type ResolveVars = {
  inquiry: InquiryMeta;
  status: 'approved' | 'denied' | 'changesRequested';
};

export const useResolveInquiryMutation = () => {
  const applyResolutionEffects = useInquiryResolutionEffects();

  return useOptimisticMutation<unknown, Error, ResolveVars>({
    mutationFn: apiMutation(({ inquiry, status }: ResolveVars) =>
      inquiryResolve({ path: { id: inquiry.id }, body: { status } }),
    ),
    targets: ({ inquiry, status }) =>
      targetMutations[inquiry.type](inquiry).map((queryKey) => ({
        queryKey,
        optimisticUpdate: (old: unknown) => {
          const cached = old as { data?: { id: string }[] } | undefined;
          if (!cached?.data) return cached;
          return {
            ...cached,
            data: cached.data.map((inq) => (inq.id === inquiry.id ? { ...inq, status } : inq)),
          };
        },
      })),
    mutationOptions: {
      onSuccess: async (_data, { inquiry, status }) => {
        await applyResolutionEffects(inquiry, status);
      },
    },
  });
};
