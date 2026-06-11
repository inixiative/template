/**
 * @atlas
 * @partOf primitive:ui
 */
import { InquiriesPage } from '@template/ui/pages/InquiriesPage';

export const OrganizationSpaceApplicationsPage = () => (
  <InquiriesPage direction="sent" filters={{ types: ['createSpace'] }} title="Space Applications" />
);
