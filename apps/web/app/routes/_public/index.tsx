import { createFileRoute } from '@tanstack/react-router';
import { HomePage } from '@template/ui/pages';

export const Route = createFileRoute('/_public/')({
  component: () => <HomePage title="Template" subtitle="TanStack Router + React Aria + Tailwind" />,
});
