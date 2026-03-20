import { inquirySend } from '@template/ui/apiClient';
import { useOptimisticMutation } from '@template/ui/hooks/useOptimisticMutation';
import { apiMutation } from '@template/ui/lib/apiMutation';
import type { InquiryMeta } from '@template/ui/lib/inquiries/queryKeys';
import { sourceMutations } from '@template/ui/lib/inquiries/queryKeys';

export const useSendInquiryMutation = () => {
  return useOptimisticMutation<unknown, Error, InquiryMeta>({
    mutationFn: apiMutation((inquiry: InquiryMeta) => inquirySend({ path: { id: inquiry.id } })),
    targets: (inquiry) =>
      sourceMutations[inquiry.type](inquiry).map((queryKey) => ({
        queryKey,
        optimisticUpdate: (old: unknown) => {
          const cached = old as { data?: { id: string }[] } | undefined;
          if (!cached?.data) return cached;
          return {
            ...cached,
            data: cached.data.map((inq) => (inq.id === inquiry.id ? { ...inq, status: 'sent' } : inq)),
          };
        },
      })),
  });
};
