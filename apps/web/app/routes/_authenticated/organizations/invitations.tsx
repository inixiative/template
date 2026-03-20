import { createFileRoute } from '@tanstack/react-router';
import { UserReceivedInvitationsPage } from '@template/ui/pages';

export const Route = createFileRoute('/_authenticated/organizations/invitations')({
  component: UserReceivedInvitationsPage,
});
