import type { InquiryReceivedItem, InquirySentItem } from '@template/ui/apiClient';
import { registerInquiryType } from '@template/ui/lib/inquiries/registry';

const UpdateSpaceSourceSummary = ({ inquiry }: { inquiry: InquirySentItem }) => {
  const content = inquiry.content as { name?: string; slug?: string } | null | undefined;
  const changes = [content?.name && `name -> ${content.name}`, content?.slug && `slug -> ${content.slug}`]
    .filter(Boolean)
    .join(', ');
  return <span>{changes || 'Space update request'}</span>;
};

const UpdateSpaceTargetSummary = ({ inquiry }: { inquiry: InquiryReceivedItem }) => (
  <span>{inquiry.sourceSpace?.name ?? inquiry.sourceOrganization?.name ?? '—'}</span>
);

registerInquiryType('updateSpace', {
  label: 'Space Update',
  source: { summary: UpdateSpaceSourceSummary },
  target: { summary: UpdateSpaceTargetSummary },
});
