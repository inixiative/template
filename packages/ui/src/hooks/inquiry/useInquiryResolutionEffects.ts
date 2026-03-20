import { useQueryClient } from '@tanstack/react-query';
import {
  meReadManyOrganizationsQueryKey,
  organizationReadManySpacesQueryKey,
  spaceProtectedQueryKey,
} from '@template/ui/apiClient';
import type { InquiryMeta } from '@template/ui/lib/inquiryQueryKeys';
import { useAppStore } from '@template/ui/store';

export const useInquiryResolutionEffects = () => {
  const refreshMe = useAppStore((state) => state.auth.refreshMe);
  const queryClient = useQueryClient();

  return async (inquiry: InquiryMeta, status: 'approved' | 'denied' | 'changesRequested') => {
    if (status !== 'approved') return;

    switch (inquiry.type) {
      case 'inviteOrganizationUser':
        await queryClient.invalidateQueries({ queryKey: meReadManyOrganizationsQueryKey() });
        await refreshMe();
        break;
      case 'createSpace':
        await queryClient.invalidateQueries({
          queryKey: organizationReadManySpacesQueryKey({ path: { id: inquiry.sourceOrganizationId } }),
        });
        break;
      case 'updateSpace':
        await queryClient.invalidateQueries({
          queryKey: spaceProtectedQueryKey({ path: { id: inquiry.sourceSpaceId } }),
        });
        break;
      case 'transferSpace':
        await queryClient.invalidateQueries({
          queryKey: organizationReadManySpacesQueryKey({ path: { id: inquiry.targetOrganizationId } }),
        });
        break;
    }
  };
};
