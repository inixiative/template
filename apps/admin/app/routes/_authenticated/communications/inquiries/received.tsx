import { createFileRoute } from '@tanstack/react-router';
import { InquiriesPage } from '@template/ui/pages';

export const Route = createFileRoute('/_authenticated/communications/inquiries/received')({
  component: () => <InquiriesPage direction="received" />,
});
