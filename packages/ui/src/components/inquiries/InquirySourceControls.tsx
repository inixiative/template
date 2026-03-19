import type { InquirySentItem } from '@template/ui/apiClient';
import { Button } from '@template/ui/components/primitives/Button';
import { useCancelInquiryMutation } from '@template/ui/hooks/inquiry';
import { useInquiryPermission } from '@template/ui/hooks/useInquiryPermission';

const TERMINAL_STATUSES = ['approved', 'denied', 'canceled'];

type InquirySourceControlsProps = {
  inquiry: InquirySentItem;
  size?: 'sm' | 'default' | 'lg';
};

export const InquirySourceControls = ({ inquiry, size = 'sm' }: InquirySourceControlsProps) => {
  const cancelMutation = useCancelInquiryMutation();
  const hasPermission = useInquiryPermission(inquiry, 'send');

  const isExpired = !!inquiry.expiresAt && new Date(inquiry.expiresAt) < new Date();
  const isTerminal = TERMINAL_STATUSES.includes(inquiry.status) || isExpired;
  const canCancel = !isTerminal && (inquiry.status === 'sent' || inquiry.status === 'draft');

  return (
    <div className="flex justify-end gap-2">
      <Button
        variant="outline"
        size={size}
        show={canCancel}
        disabled={!hasPermission}
        onClick={() => cancelMutation.mutate(inquiry)}
      >
        Cancel
      </Button>
    </div>
  );
};
