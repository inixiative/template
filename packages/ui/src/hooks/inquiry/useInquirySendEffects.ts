import { useQueryClient } from '@tanstack/react-query';
import type { InquiryMeta } from '@template/ui/lib/inquiryQueryKeys';
import { sourceMutations } from '@template/ui/lib/inquiryQueryKeys';

export const useInquirySendEffects = () => {
  const queryClient = useQueryClient();

  return async (inquiry: InquiryMeta, _action: 'create' | 'send' | 'update' | 'cancel') => {
    for (const key of sourceMutations[inquiry.type](inquiry)) {
      await queryClient.invalidateQueries({ queryKey: key });
    }
    // extend per type as needed
  };
};
