/**
 * @atlas
 * @kind page
 * @partOf feature:tenancy
 */
import { createFileRoute } from '@tanstack/react-router';
import { OrganizationsPage } from '@template/ui/pages';

export const Route = createFileRoute('/_authenticated/organizations/mine')({
  component: OrganizationsPage,
});
