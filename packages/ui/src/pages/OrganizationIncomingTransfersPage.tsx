import { InquiriesPage } from '@template/ui/pages/InquiriesPage';

type OrganizationIncomingTransfersPageProps = {
  /** @deprecated reads from tenant context store */
  organizationId?: string;
};

export const OrganizationIncomingTransfersPage = (_props: OrganizationIncomingTransfersPageProps) => (
  <InquiriesPage direction="received" filters={{ types: ['transferSpace'] }} title="Incoming Transfers" />
);
