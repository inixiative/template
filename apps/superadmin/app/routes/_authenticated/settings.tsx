import { createFileRoute } from '@tanstack/react-router';
import { redirectPreservingContext } from '@template/ui/lib';

export const Route = createFileRoute('/_authenticated/settings')({
  beforeLoad: (context) => {
    if (context.location.pathname === '/settings') {
      redirectPreservingContext(context, '/settings/profile');
    }
  },
});
