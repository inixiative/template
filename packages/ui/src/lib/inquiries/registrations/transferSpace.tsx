import type { InquiryReceivedItem, InquirySentItem } from '@template/ui/apiClient';
import { registerInquiryType } from '@template/ui/lib/inquiries/registry';

const TransferSourceSummary = ({ inquiry }: { inquiry: InquirySentItem }) => (
  <span>{inquiry.targetOrganization?.name ?? '—'}</span>
);

const TransferTargetSummary = ({ inquiry }: { inquiry: InquiryReceivedItem }) => (
  <span>{inquiry.sourceSpace?.name ?? '—'}</span>
);

registerInquiryType('transferSpace', {
  label: 'Space Transfer',
  source: { summary: TransferSourceSummary },
  target: { summary: TransferTargetSummary },
});
