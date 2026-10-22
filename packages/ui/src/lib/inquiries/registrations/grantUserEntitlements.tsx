/**
 * @atlas
 * @kind registry
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { InquiryReceivedItem, InquirySentItem } from '@template/sdk';
import { registerInquiryType } from '@template/ui/lib/inquiries/registry';

type EntitlementGrantContent = {
  purpose?: string;
  role?: string;
  entitlements?: Record<string, unknown> | null;
};

const describeEntitlementGrant = (content: EntitlementGrantContent | null | undefined) => {
  const keys = Object.keys(content?.entitlements ?? {});
  const scope = [content?.role, keys.length ? keys.join(', ') : null].filter(Boolean).join(': ');
  return [content?.purpose, scope && `(${scope})`].filter(Boolean).join(' ');
};

const GrantUserEntitlementsSourceSummary = ({ inquiry }: { inquiry: InquirySentItem }) => (
  <span>
    {describeEntitlementGrant(inquiry.content as EntitlementGrantContent) || 'Access grant request'}
  </span>
);

const GrantUserEntitlementsTargetSummary = ({ inquiry }: { inquiry: InquiryReceivedItem }) => (
  <span>
    {inquiry.sourceUser?.email ?? '—'}{' '}
    <span className="text-muted-foreground">
      {describeEntitlementGrant(inquiry.content as EntitlementGrantContent)}
    </span>
  </span>
);

registerInquiryType('grantUserEntitlements', {
  label: 'Access Grant',
  source: { summary: GrantUserEntitlementsSourceSummary },
  target: { summary: GrantUserEntitlementsTargetSummary },
});
