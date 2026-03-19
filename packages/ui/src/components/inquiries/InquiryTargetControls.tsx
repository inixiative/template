import type { InquiryReceivedItem } from '@template/ui/apiClient';
import { Button } from '@template/ui/components/primitives/Button';
import { useResolveInquiryMutation } from '@template/ui/hooks/inquiry';
import { useInquiryPermission } from '@template/ui/hooks/useInquiryPermission';
import { isTerminalInquiry } from '@template/ui/lib/inquiryQueryKeys';

type InquiryTargetControlsProps = {
  inquiry: InquiryReceivedItem;
  size?: 'sm' | 'default' | 'lg';
};

export const InquiryTargetControls = ({ inquiry, size = 'sm' }: InquiryTargetControlsProps) => {
  const resolveMutation = useResolveInquiryMutation();
  const hasPermission = useInquiryPermission(inquiry, 'resolve', 'target');

  const isTerminal = isTerminalInquiry(inquiry);
  const canResolve = !isTerminal && (inquiry.status === 'sent' || inquiry.status === 'changesRequested');
  const isPersistedInquiry = !!inquiry.id && inquiry.id !== '__optimistic__';

  return (
    <div className="flex justify-end gap-2">
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
    </div>
  );
};
