import type { InquirySentItem } from '@template/ui/apiClient';
import { Button } from '@template/ui/components/primitives/Button';
import { useCancelInquiryMutation, useSendInquiryMutation } from '@template/ui/hooks/inquiry';
import { useInquiryPermission } from '@template/ui/hooks/useInquiryPermission';
import { isTerminalInquiry } from '@template/ui/lib/inquiryQueryKeys';

type InquirySourceControlsProps = {
  inquiry: InquirySentItem;
  size?: 'sm' | 'default' | 'lg';
  onEdit?: () => void;
};

export const InquirySourceControls = ({ inquiry, size = 'sm', onEdit }: InquirySourceControlsProps) => {
  const cancelMutation = useCancelInquiryMutation();
  const sendMutation = useSendInquiryMutation();
  const hasPermission = useInquiryPermission(inquiry, 'send', 'source');

  const isTerminal = isTerminalInquiry(inquiry);
  const isDraft = inquiry.status === 'draft';
  const canEdit = !isTerminal && !!onEdit;
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
        onClick={onEdit}
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
    </div>
  );
};
