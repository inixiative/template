/**
 * @atlas
 * @kind registry
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { InquiryItem } from '@template/sdk';
import type { SpaceContent } from '@template/shared/inquiry';
import { registerInquiryType } from '@template/ui/lib/inquiries/registry';

const CreateSpaceSourceSummary = ({ inquiry }: { inquiry: InquiryItem }) => {
  const content = inquiry.content as SpaceContent | null | undefined;
  return (
    <span>
      {content?.name ?? '—'}
      {content?.slug && <span className="text-muted-foreground ml-1">/{content.slug}</span>}
    </span>
  );
};

const CreateSpaceTargetSummary = ({ inquiry }: { inquiry: InquiryItem }) => (
  <span>{inquiry.sourceOrganization?.name ?? '—'}</span>
);

registerInquiryType('createSpace', {
  label: 'Space Request',
  source: { summary: CreateSpaceSourceSummary },
  target: { summary: CreateSpaceTargetSummary },
});
