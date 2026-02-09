import { createFileRoute } from '@tanstack/react-router';
import { ComingSoon } from '@template/ui';

const CommunicationsPage = () => {
  return <ComingSoon title="Communications" description="Organization communications tooling is not wired yet." />;
};

export const Route = createFileRoute('/_authenticated/communications')({
  component: CommunicationsPage,
});
