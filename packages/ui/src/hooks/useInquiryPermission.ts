import type { HydratedRecord } from '@template/db';
import type { InquiryReceivedItem, InquirySentItem } from '@template/ui/apiClient';
import type { ActionRule } from '@template/permissions/rebac/types';
import { checkPermission } from '@template/ui/hooks/usePermission';
import { useAppStore } from '@template/ui/store';

export const useInquiryPermission = (
  inquiry: InquirySentItem | InquiryReceivedItem,
  action: ActionRule,
): boolean => {
  const permissions = useAppStore((state) => state.permissions);
  const context = useAppStore((state) => state.tenant.context);

  const org = context.organization ? { id: context.organization.id } : undefined;
  const space = context.space ? { id: context.space.id, organization: org } : undefined;

  // Blindly fill both sides from context first, then spread actual inquiry on top.
  // Inquiry data overrides context for the side it carries; context fills the stripped side.
  const hydrated = {
    sourceOrganization: org,
    sourceSpace: space,
    targetOrganization: org,
    targetSpace: space,
    ...inquiry,
  };

  return checkPermission(permissions, 'inquiry', hydrated as unknown as HydratedRecord, action);
};
