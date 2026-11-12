/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { InquirySide } from '@template/permissions/rebac/inquiryPermission';
import type { ActionRule } from '@template/permissions/rebac/types';
import { checkPermission } from '@template/ui/hooks/usePermission';
import {
  type CheckableInquiry,
  type InquiryPartyContext,
  inquiryCheckRecord,
} from '@template/ui/lib/inquiries/inquiryCheckRecord';
import { useAppStore } from '@template/ui/store';

const useInquiryPartyContext = (): InquiryPartyContext => {
  const context = useAppStore((state) => state.tenant.context);
  const user = useAppStore((state) => state.auth.user);
  const organization = context.organization ? { id: context.organization.id } : undefined;
  return {
    user: user ? { id: user.id } : undefined,
    organization,
    space: context.space ? { id: context.space.id, organization } : undefined,
  };
};

export const useInquiryPermission = (
  inquiry: CheckableInquiry,
  action: ActionRule,
  side: InquirySide,
): boolean => {
  const permissions = useAppStore((state) => state.permissions);
  const parties = useInquiryPartyContext();
  return checkPermission(
    permissions,
    'inquiry',
    inquiryCheckRecord(inquiry, side, parties),
    action,
  );
};
