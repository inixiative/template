import type { InquiryReceivedItem, InquirySentItem } from '@template/ui/apiClient';
import { registerInquiryType } from '@template/ui/lib/inquiries/registry';

const InviteSourceSummary = ({ inquiry }: { inquiry: InquirySentItem }) => {
  const content = inquiry.content as { email?: string; role?: string } | null | undefined;
  const email = inquiry.targetUser?.email ?? content?.email ?? '—';
  const role = content?.role;
  return (
    <span>
      {email}
      {role && <span className="text-muted-foreground ml-1 capitalize">({role})</span>}
    </span>
  );
};

const InviteTargetSummary = ({ inquiry }: { inquiry: InquiryReceivedItem }) => {
  const content = inquiry.content as { role?: string } | null | undefined;
  const org = inquiry.sourceOrganization?.name ?? '—';
  const role = content?.role;
  return (
    <span>
      {org}
      {role && <span className="text-muted-foreground ml-1 capitalize">({role})</span>}
    </span>
  );
};

registerInquiryType('inviteOrganizationUser', {
  label: 'Organization Invitation',
  source: { summary: InviteSourceSummary },
  target: { summary: InviteTargetSummary },
});
