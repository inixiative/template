/**
 * @atlas
 * @kind registry
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { InquiryReceivedItem, InquirySentItem } from '@template/sdk';
import { registerInquiryType } from '@template/ui/lib/inquiries/registry';

type SliceContent = {
  purpose?: string;
  role?: string;
  entitlements?: Record<string, boolean> | null;
  entitlementsOnly?: boolean;
};

const describeSlice = (content: SliceContent | null | undefined) => {
  const actions = Object.keys(content?.entitlements ?? {}).filter(
    (action) => content?.entitlements?.[action],
  );
  const scope = content?.entitlementsOnly ? actions.join(', ') || 'nothing' : content?.role;
  return [content?.purpose, scope && `(${scope})`].filter(Boolean).join(' ');
};

const GrantUserSliceSourceSummary = ({ inquiry }: { inquiry: InquirySentItem }) => (
  <span>{describeSlice(inquiry.content as SliceContent) || 'Access grant request'}</span>
);

const GrantUserSliceTargetSummary = ({ inquiry }: { inquiry: InquiryReceivedItem }) => (
  <span>
    {inquiry.sourceUser?.email ?? '—'}{' '}
    <span className="text-muted-foreground">{describeSlice(inquiry.content as SliceContent)}</span>
  </span>
);

registerInquiryType('grantUserSlice', {
  label: 'Access Grant',
  source: { summary: GrantUserSliceSourceSummary },
  target: { summary: GrantUserSliceTargetSummary },
});
