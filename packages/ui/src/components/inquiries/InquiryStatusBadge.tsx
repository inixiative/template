/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { InquiryItem } from '@template/sdk';
import { Badge } from '@template/ui/components/primitives/Badge';
import { INQUIRY_STATUS_BADGE_CLASSES } from '@template/ui/lib/inquiries/queryKeys';

export type InquiryStatusBadgeProps = {
  inquiry: Pick<InquiryItem, 'status' | 'expiresAt'>;
};

export const InquiryStatusBadge = ({ inquiry }: InquiryStatusBadgeProps) => {
  const isExpired = Boolean(inquiry.expiresAt && new Date(inquiry.expiresAt) < new Date());
  const label = isExpired ? 'expired' : inquiry.status;
  return (
    <Badge className={INQUIRY_STATUS_BADGE_CLASSES[isExpired ? 'expired' : inquiry.status]}>
      <span className="capitalize">{label}</span>
    </Badge>
  );
};
