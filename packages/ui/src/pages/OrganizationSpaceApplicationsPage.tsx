import { InquiriesPage } from '@template/ui/pages/InquiriesPage';

type OrganizationSpaceApplicationsPageProps = {
  /** @deprecated reads from tenant context store */
  organizationId?: string;
};

export const OrganizationSpaceApplicationsPage = (_props: OrganizationSpaceApplicationsPageProps) => (
  <InquiriesPage direction="sent" filters={{ types: ['createSpace'] }} title="Space Applications" />
);
