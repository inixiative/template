/**
 * @atlas
 * @kind registry
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { InquiryItem } from '@template/sdk';
import type { InviteOrganizationUserContent } from '@template/shared/inquiry';
import { registerInquiryType } from '@template/ui/lib/inquiries/registry';

const InviteSourceSummary = ({ inquiry }: { inquiry: InquiryItem }) => {
  const content = inquiry.content as Partial<InviteOrganizationUserContent> | null | undefined;
  const email = inquiry.targetUser?.email ?? '—';
  const role = content?.role;
  return (
    <span>
      {email}
      {role && <span className="text-muted-foreground ml-1 capitalize">({role})</span>}
    </span>
  );
};

const InviteTargetSummary = ({ inquiry }: { inquiry: InquiryItem }) => {
  const content = inquiry.content as Partial<InviteOrganizationUserContent> | null | undefined;
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
