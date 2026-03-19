import type { HydratedRecord } from '@template/db';
import type { ActionRule } from '@template/permissions/rebac/types';
import type { InquiryReceivedItem, InquirySentItem } from '@template/ui/apiClient';
import { checkPermission } from '@template/ui/hooks/usePermission';
import { useAppStore } from '@template/ui/store';

export const useInquiryPermission = (
  inquiry: InquirySentItem | InquiryReceivedItem,
  action: ActionRule,
  side: 'source' | 'target',
): boolean => {
  const permissions = useAppStore((state) => state.permissions);
  const context = useAppStore((state) => state.tenant.context);

  const org = context.organization ? { id: context.organization.id } : undefined;
  const space = context.space ? { id: context.space.id, organization: org } : undefined;

  // Fill only the side the current context occupies; the inquiry carries the other side's data.
  const contextFill =
    side === 'source'
      ? { sourceOrganization: org, sourceSpace: space }
      : { targetOrganization: org, targetSpace: space };

  const hydrated = { ...contextFill, ...inquiry };

  return checkPermission(permissions, 'inquiry', hydrated as unknown as HydratedRecord, action);
};
