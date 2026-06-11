/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { InquiriesPage } from '@template/ui/pages/InquiriesPage';

export const OrganizationSpaceApplicationsPage = () => (
  <InquiriesPage direction="sent" filters={{ types: ['createSpace'] }} title="Space Applications" />
);
