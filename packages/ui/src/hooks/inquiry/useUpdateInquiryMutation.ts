import { inquiryUpdate } from '@template/ui/apiClient';
import { useOptimisticMutation } from '@template/ui/hooks/useOptimisticMutation';
import { apiMutation } from '@template/ui/lib/apiMutation';
import type { InquiryMeta } from '@template/ui/lib/inquiryQueryKeys';
import { sourceMutations } from '@template/ui/lib/inquiryQueryKeys';

type UpdateVars = {
  inquiry: InquiryMeta;
  body: { content?: Record<string, unknown>; status?: 'draft' | 'sent' };
};

export const useUpdateInquiryMutation = () => {
  return useOptimisticMutation<unknown, Error, UpdateVars>({
    mutationFn: apiMutation(({ inquiry, body }: UpdateVars) => inquiryUpdate({ path: { id: inquiry.id }, body })),
    targets: ({ inquiry, body }) =>
      sourceMutations[inquiry.type](inquiry).map((queryKey) => ({
        queryKey,
        optimisticUpdate: (old: unknown) => {
          const cached = old as { data?: { id: string }[] } | undefined;
          if (!cached?.data) return cached;
          return {
            ...cached,
            data: cached.data.map((inq) => (inq.id === inquiry.id ? { ...inq, ...body } : inq)),
          };
        },
      })),
  });
};
