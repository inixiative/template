import { createFileRoute } from '@tanstack/react-router';
import { SpaceTransferInquiryPage } from '@template/ui/pages';

export const Route = createFileRoute('/_authenticated/settings/transfer')({
  component: SpaceTransferInquiryPage,
});
