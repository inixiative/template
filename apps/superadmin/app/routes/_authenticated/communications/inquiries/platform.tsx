import { createFileRoute } from '@tanstack/react-router';
import { AdminInquiriesPage } from '@template/ui/pages';

export const Route = createFileRoute('/_authenticated/communications/inquiries/platform')({
  component: () => <AdminInquiriesPage view="platform" />,
});
