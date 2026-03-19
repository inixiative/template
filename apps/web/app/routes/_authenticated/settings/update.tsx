import { createFileRoute } from '@tanstack/react-router';
import { SpaceUpdateInquiryPage } from '@template/ui/pages';

export const Route = createFileRoute('/_authenticated/settings/update')({
  component: SpaceUpdateInquiryPage,
});
