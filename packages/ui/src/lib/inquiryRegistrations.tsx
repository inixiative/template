/**
 * Side-effect module — imports register all inquiry types into the registry.
 * Import this file once at app initialization (done via lib/index.ts).
 */
import type { InquiryReceivedItem, InquirySentItem } from '@template/ui/apiClient';
import { registerInquiryType } from '@template/ui/lib/inquiryRegistry';

// ─── inviteOrganizationUser ───────────────────────────────────────────────────

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

// ─── createSpace ─────────────────────────────────────────────────────────────

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

// ─── updateSpace ─────────────────────────────────────────────────────────────

// InquirySentItem has sourceSpaceId (not sourceSpace relation) — show proposed changes from content
const UpdateSpaceSourceSummary = ({ inquiry }: { inquiry: InquirySentItem }) => {
  const content = inquiry.content as { name?: string; slug?: string } | null | undefined;
  const changes = [content?.name && `name → ${content.name}`, content?.slug && `slug → ${content.slug}`]
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

// ─── transferSpace ────────────────────────────────────────────────────────────

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
