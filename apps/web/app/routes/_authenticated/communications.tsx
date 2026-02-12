import { createFileRoute } from '@tanstack/react-router';
import { ComingSoon } from '@template/ui/components';

const CommunicationsPage = () => {
  return (
    <ComingSoon title="Communications" description="Email preferences and notification settings are not wired yet." />
  );
};

export const Route = createFileRoute('/_authenticated/communications')({
  component: CommunicationsPage,
});
