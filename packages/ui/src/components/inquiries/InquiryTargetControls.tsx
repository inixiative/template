import type { InquiryReceivedItem } from '@template/ui/apiClient';
import { Button } from '@template/ui/components/primitives/Button';
import { useResolveInquiryMutation } from '@template/ui/hooks/inquiry';
import { useInquiryPermission } from '@template/ui/hooks/useInquiryPermission';

const TERMINAL_STATUSES = ['approved', 'denied', 'canceled'];

type InquiryTargetControlsProps = {
  inquiry: InquiryReceivedItem;
  size?: 'sm' | 'default' | 'lg';
};

export const InquiryTargetControls = ({ inquiry, size = 'sm' }: InquiryTargetControlsProps) => {
  const resolveMutation = useResolveInquiryMutation();
  const hasPermission = useInquiryPermission(inquiry, 'resolve');

  const isExpired = !!inquiry.expiresAt && new Date(inquiry.expiresAt) < new Date();
  const isTerminal = TERMINAL_STATUSES.includes(inquiry.status) || isExpired;
  const canResolve = !isTerminal && (inquiry.status === 'sent' || inquiry.status === 'changesRequested');

  return (
    <div className="flex justify-end gap-2">
      <Button
        variant="outline"
        size={size}
        show={canResolve}
        disabled={!hasPermission}
        onClick={() => resolveMutation.mutate({ inquiry, status: 'approved' })}
      >
        Approve
      </Button>
      <Button
        variant="outline"
        size={size}
        show={canResolve}
        disabled={!hasPermission}
        onClick={() => resolveMutation.mutate({ inquiry, status: 'denied' })}
      >
        Decline
      </Button>
    </div>
  );
};
