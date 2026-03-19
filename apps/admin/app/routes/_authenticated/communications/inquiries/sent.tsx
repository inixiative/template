import { createFileRoute } from '@tanstack/react-router';
import { InquiriesPage } from '@template/ui/pages';

export const Route = createFileRoute('/_authenticated/communications/inquiries/sent')({
  component: () => <InquiriesPage direction="sent" />,
});
