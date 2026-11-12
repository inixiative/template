/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { HydratedRecord } from '@template/db';
import type { InquirySide } from '@template/permissions/rebac/inquiryPermission';
import type { InquirySentItem } from '@template/sdk';

export type CheckableInquiry = Pick<InquirySentItem, 'type' | 'sourceModel' | 'targetModel'> & {
  content?: unknown;
};

type Ref = { id: string };
export type InquiryPartyContext = {
  user?: Ref;
  organization?: Ref;
  space?: Ref & { organization?: Ref };
};

export const inquiryCheckRecord = (
  inquiry: CheckableInquiry,
  side: InquirySide,
  { user, organization, space }: InquiryPartyContext,
): HydratedRecord => {
  const contextFill =
    side === 'source'
      ? { sourceUser: user, sourceOrganization: organization, sourceSpace: space }
      : { targetUser: user, targetOrganization: organization, targetSpace: space };
  return { ...contextFill, ...inquiry } as unknown as HydratedRecord;
};
