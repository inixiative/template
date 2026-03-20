import type { InquiryReceivedItem } from '@template/ui/apiClient';
import { Button } from '@template/ui/components/primitives/Button';
import { useResolveInquiryMutation } from '@template/ui/hooks/inquiry';
import { useInquiryPermission } from '@template/ui/hooks/useInquiryPermission';
import { isTerminalInquiry } from '@template/ui/lib/inquiries/queryKeys';
import { getInquiryInterface } from '@template/ui/lib/inquiries/registry';
import { useState } from 'react';

type InquiryTargetControlsProps = {
  inquiry: InquiryReceivedItem;
  size?: 'sm' | 'default' | 'lg';
};

export const InquiryTargetControls = ({ inquiry, size = 'sm' }: InquiryTargetControlsProps) => {
  const resolveMutation = useResolveInquiryMutation();
  const hasPermission = useInquiryPermission(inquiry, 'resolve', 'target');
  const [isOpen, setIsOpen] = useState(false);

  const isTerminal = isTerminalInquiry(inquiry);
  const canResolve = !isTerminal && (inquiry.status === 'sent' || inquiry.status === 'changesRequested');
  const isPersistedInquiry = !!inquiry.id && inquiry.id !== '__optimistic__';

  const entry = getInquiryInterface(inquiry.type);
  const Review = entry?.target?.review;

  return (
    <div className="flex justify-end gap-2">
      {Review && (
        <Button
          variant="outline"
          size={size}
          show={canResolve}
          disabled={!isPersistedInquiry || !hasPermission}
          onClick={() => setIsOpen(true)}
        >
          Review
        </Button>
      )}
      <Button
        variant="outline"
        size={size}
        show={canResolve}
        disabled={!isPersistedInquiry || !hasPermission}
        onClick={() => resolveMutation.mutate({ inquiry, status: 'approved' })}
      >
        Approve
      </Button>
      <Button
        variant="outline"
        size={size}
        show={canResolve}
        disabled={!isPersistedInquiry || !hasPermission}
        onClick={() => resolveMutation.mutate({ inquiry, status: 'denied' })}
      >
        Decline
      </Button>
      {Review && isOpen && <Review inquiry={inquiry} onClose={() => setIsOpen(false)} />}
    </div>
  );
};
