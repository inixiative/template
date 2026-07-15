/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { InquiriesPage } from '@template/ui/pages/InquiriesPage';

export const OrganizationSentInvitationsPage = () => (
  <InquiriesPage direction="sent" filters={{ types: ['inviteOrganizationUser'] }} title="Sent Invitations" />
);
