import { createFileRoute } from '@tanstack/react-router';
import { HomePage } from '@template/shared';

export const Route = createFileRoute('/')(
  {
    component: () => <HomePage title="Admin" subtitle="Organization management dashboard" />,
  },
);
