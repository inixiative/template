import type { InquiryMeta } from '@template/ui/lib/inquiries/queryKeys';

export const useInquirySendEffects = () => {
  return async (_inquiry: InquiryMeta, _action: 'create' | 'send' | 'update' | 'cancel') => {
    // extend per type as needed
  };
};
