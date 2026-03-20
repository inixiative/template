import { createFileRoute } from '@tanstack/react-router';
import { redirectPreservingContext } from '@template/ui/lib';

export const Route = createFileRoute('/_authenticated/communications')({
  beforeLoad: (context) => {
    if (context.location.pathname === '/communications') {
      redirectPreservingContext(context, '/communications/inquiries/received');
    }
  },
});
