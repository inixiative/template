/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { InquiryItem } from '@template/sdk';
import { Button } from '@template/ui/components/primitives/Button';
import { useResolveInquiryMutation } from '@template/ui/hooks/inquiry';
import { useCanActOnInquiry } from '@template/ui/hooks/useCanActOnInquiry';
import { isInquiryClosedOrExpired } from '@template/ui/lib/inquiries/queryKeys';
import { inquiryTypeComponentsFor } from '@template/ui/lib/inquiries/registry';
import { useState } from 'react';

type InquiryTargetControlsProps = {
  inquiry: InquiryItem;
  size?: 'sm' | 'default' | 'lg';
};

export const InquiryTargetControls = ({ inquiry, size = 'sm' }: InquiryTargetControlsProps) => {
  const resolveMutation = useResolveInquiryMutation();
  const hasPermission = useCanActOnInquiry(inquiry, 'resolve', 'target');
  const [isOpen, setIsOpen] = useState(false);

  const isTerminal = isInquiryClosedOrExpired(inquiry);
  const canResolve =
    !isTerminal && (inquiry.status === 'sent' || inquiry.status === 'changesRequested');
  const isPersistedInquiry = !!inquiry.id && inquiry.id !== '__optimistic__';

  const entry = inquiryTypeComponentsFor(inquiry.type);
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
        show={canResolve && !entry?.target?.approvesOnlyInReview}
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
