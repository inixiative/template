import type { InquiryReceivedItem, InquirySentItem } from '@template/ui/apiClient';
import { registerInquiryType } from '@template/ui/lib/inquiries/registry';

const CreateSpaceSourceSummary = ({ inquiry }: { inquiry: InquirySentItem }) => {
  const content = inquiry.content as { name?: string; slug?: string } | null | undefined;
  return (
    <span>
      {content?.name ?? '—'}
      {content?.slug && <span className="text-muted-foreground ml-1">/{content.slug}</span>}
    </span>
  );
};

const CreateSpaceTargetSummary = ({ inquiry }: { inquiry: InquiryReceivedItem }) => (
  <span>{inquiry.sourceOrganization?.name ?? '—'}</span>
);

registerInquiryType('createSpace', {
  label: 'Space Request',
  source: { summary: CreateSpaceSourceSummary },
  target: { summary: CreateSpaceTargetSummary },
});
