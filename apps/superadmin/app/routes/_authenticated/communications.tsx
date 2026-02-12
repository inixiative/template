import { createFileRoute } from '@tanstack/react-router';
import { ComingSoon } from '@template/ui/components';

const CommunicationsPage = () => {
  return (
    <ComingSoon
      title="Platform Communications"
      description="Platform-wide email templates and notification settings are not wired yet."
    />
  );
};

export const Route = createFileRoute('/_authenticated/communications')({
  component: CommunicationsPage,
});
