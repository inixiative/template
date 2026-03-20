import { InquiriesPage } from '@template/ui/pages/InquiriesPage';

export const UserReceivedInvitationsPage = () => (
  <InquiriesPage direction="received" filters={{ types: ['inviteOrganizationUser'] }} title="Received Invitations" />
);
