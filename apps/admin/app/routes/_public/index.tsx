import { createFileRoute } from '@tanstack/react-router';
import { HomePage } from '@template/ui/pages';

export const Route = createFileRoute('/_public/')({
  component: () => <HomePage title="Admin" subtitle="Organization management dashboard" />,
});
