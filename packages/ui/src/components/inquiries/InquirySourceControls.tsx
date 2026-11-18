/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { InquiryItem } from '@template/sdk';
import { Button } from '@template/ui/components/primitives/Button';
import { useCancelInquiryMutation, useSendInquiryMutation } from '@template/ui/hooks/inquiry';
import { useCanActOnInquiry } from '@template/ui/hooks/useCanActOnInquiry';
import { isInquiryClosedOrExpired } from '@template/ui/lib/inquiries/queryKeys';
import { inquiryTypeComponentsFor } from '@template/ui/lib/inquiries/registry';
import { useState } from 'react';

type InquirySourceControlsProps = {
  inquiry: InquiryItem;
  size?: 'sm' | 'default' | 'lg';
};

export const InquirySourceControls = ({ inquiry, size = 'sm' }: InquirySourceControlsProps) => {
  const cancelMutation = useCancelInquiryMutation();
  const sendMutation = useSendInquiryMutation();
  const hasPermission = useCanActOnInquiry(inquiry, 'send', 'source');
  const [isOpen, setIsOpen] = useState(false);

  const isTerminal = isInquiryClosedOrExpired(inquiry);
  const isDraft = inquiry.status === 'draft';

  const entry = inquiryTypeComponentsFor(inquiry.type);
  const Compose = entry?.source?.compose;

  const canEdit = !isTerminal && !!Compose;
  const canSend = isDraft || inquiry.status === 'changesRequested';
  const canCancel = !isTerminal && (inquiry.status === 'sent' || isDraft);
  const isPersistedInquiry = !!inquiry.id && inquiry.id !== '__optimistic__';

  return (
    <div className="flex justify-end gap-2">
      <Button
        variant="outline"
        size={size}
        show={canEdit}
        disabled={!isPersistedInquiry || !hasPermission}
        onClick={() => setIsOpen(true)}
      >
        Edit
      </Button>
      <Button
        size={size}
        show={canSend}
        disabled={!isPersistedInquiry || !hasPermission || sendMutation.isPending}
        onClick={() => sendMutation.mutate(inquiry)}
      >
        Send
      </Button>
      <Button
        variant="outline"
        size={size}
        show={canCancel}
        disabled={!isPersistedInquiry || !hasPermission}
        onClick={() => cancelMutation.mutate(inquiry)}
      >
        Cancel
      </Button>
      {Compose && isOpen && <Compose inquiry={inquiry} onClose={() => setIsOpen(false)} />}
    </div>
  );
};
