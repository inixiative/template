/**
 * @atlas
 * @kind utils
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { InquirySide } from '@template/permissions/rebac/inquiryResourcePermission';
import type { InquiryItem } from '@template/sdk';

type InquiryParties = Pick<
  InquiryItem,
  | 'sourceModel'
  | 'sourceUser'
  | 'sourceOrganization'
  | 'sourceSpace'
  | 'targetModel'
  | 'targetUser'
  | 'targetOrganization'
  | 'targetSpace'
>;

export const inquiryPartyDisplayName = (inquiry: InquiryParties, side: InquirySide): string => {
  if (side === 'source') {
    if (inquiry.sourceUser) return inquiry.sourceUser.name || inquiry.sourceUser.email;
    if (inquiry.sourceOrganization) return inquiry.sourceOrganization.name;
    if (inquiry.sourceSpace) return inquiry.sourceSpace.name;
    return inquiry.sourceModel;
  }
  if (inquiry.targetUser) return inquiry.targetUser.name || inquiry.targetUser.email;
  if (inquiry.targetOrganization) return inquiry.targetOrganization.name;
  if (inquiry.targetSpace) return inquiry.targetSpace.name;
  return inquiry.targetModel;
};
