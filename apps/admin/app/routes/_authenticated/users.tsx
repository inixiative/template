import { createFileRoute } from '@tanstack/react-router';
import { redirectPreservingContext } from '@template/ui/lib';

export const Route = createFileRoute('/_authenticated/users')({
  beforeLoad: (context) => {
    if (context.location.pathname === '/users') {
      redirectPreservingContext(context, '/users/members');
    }
  },
});
