import { InquiriesPage } from '@template/ui/pages/InquiriesPage';

type OrganizationSentInvitationsPageProps = {
  /** @deprecated reads from tenant context store */
  organizationId?: string;
};

export const OrganizationSentInvitationsPage = (_props: OrganizationSentInvitationsPageProps) => (
  <InquiriesPage direction="sent" filters={{ types: ['inviteOrganizationUser'] }} title="Sent Invitations" />
);
