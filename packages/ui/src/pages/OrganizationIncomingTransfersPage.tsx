/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { InquiriesPage } from '@template/ui/pages/InquiriesPage';

export const OrganizationIncomingTransfersPage = () => (
  <InquiriesPage direction="received" filters={{ types: ['transferSpace'] }} title="Incoming Transfers" />
);
