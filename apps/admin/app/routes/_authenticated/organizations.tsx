import { createFileRoute } from '@tanstack/react-router';
import { redirectPreservingContext } from '@template/ui/lib';

export const Route = createFileRoute('/_authenticated/organizations')({
  beforeLoad: (context) => {
    if (context.location.pathname === '/organizations') {
      redirectPreservingContext(context, '/organizations/mine');
    }
  },
});
