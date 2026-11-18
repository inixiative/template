/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { InquirySide } from '@template/permissions/rebac/inquiryResourcePermission';
import type { ActionRule } from '@template/permissions/rebac/types';
import { canActOnRecordIfPresent } from '@template/ui/lib/canActOnRecordIfPresent';
import {
  type CheckableInquiry,
  type InquiryPartyContext,
  inquiryRecordForPermissionCheck,
} from '@template/ui/lib/inquiries/inquiryRecordForPermissionCheck';
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

export const useCanActOnInquiry = (
  inquiry: CheckableInquiry,
  action: ActionRule,
  side: InquirySide,
): boolean => {
  const permissions = useAppStore((state) => state.permissions);
  const parties = useInquiryPartyContext();
  return canActOnRecordIfPresent(
    permissions,
    'inquiry',
    inquiryRecordForPermissionCheck(inquiry, side, parties),
    action,
  );
};
