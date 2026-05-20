import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import {
  meReadManyOrganizationsQueryKey,
  organizationReadManySpacesQueryKey,
  spaceProtectedQueryKey,
} from '@template/sdk';
import type { InquiryMeta, InquiryType } from '@template/ui/lib/inquiries/queryKeys';
import { useAppStore } from '@template/ui/store';

type EffectContext = {
  refreshMe: () => Promise<void>;
  queryClient: QueryClient;
};

// One entry per InquiryType — `Record<InquiryType, …>` makes this exhaustive
// by construction so a new type added to the enum is a TS error here until
// its post-approval effect is declared (or explicitly no-op'd). No switch
// fall-through, no silent gaps.
const RESOLUTION_EFFECTS: Record<InquiryType, (inq: InquiryMeta, ctx: EffectContext) => Promise<void>> = {
  inviteOrganizationUser: async (_inq, { refreshMe, queryClient }) => {
    await queryClient.invalidateQueries({ queryKey: meReadManyOrganizationsQueryKey() });
    await refreshMe();
  },
  createSpace: async (inq, { queryClient }) => {
    await queryClient.invalidateQueries({
      queryKey: organizationReadManySpacesQueryKey({ path: { id: inq.sourceOrganizationId! } }),
    });
  },
  updateSpace: async (inq, { queryClient }) => {
    await queryClient.invalidateQueries({
      queryKey: spaceProtectedQueryKey({ path: { id: inq.sourceSpaceId! } }),
    });
  },
  transferSpace: async (inq, { queryClient }) => {
    await queryClient.invalidateQueries({
      queryKey: organizationReadManySpacesQueryKey({ path: { id: inq.targetOrganizationId! } }),
    });
  },
};

export const useInquiryResolutionEffects = () => {
  const refreshMe = useAppStore((state) => state.auth.refreshMe);
  const queryClient = useQueryClient();

  return async (inquiry: InquiryMeta, status: 'approved' | 'denied' | 'changesRequested') => {
    if (status !== 'approved') return;
    await RESOLUTION_EFFECTS[inquiry.type](inquiry, { refreshMe, queryClient });
  };
};
