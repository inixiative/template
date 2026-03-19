import { createFileRoute } from '@tanstack/react-router';
import { redirectPreservingContext } from '@template/ui/lib';

export const Route = createFileRoute('/_authenticated/communications/inquiries')({
  beforeLoad: (context) => {
    if (context.location.pathname === '/communications/inquiries') {
      redirectPreservingContext(context, '/communications/inquiries/received');
    }
  },
});
