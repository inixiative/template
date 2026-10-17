/**
 * @atlas
 * @kind page
 * @partOf feature:segment
 * @uses primitive:ui
 */
import { createFileRoute } from '@tanstack/react-router';
import { redirectPreservingContext } from '@template/ui/lib';

export const Route = createFileRoute('/_authenticated/segments')({
  beforeLoad: (context) => {
    if (context.location.pathname === '/segments' || context.location.pathname === '/segments/') {
      redirectPreservingContext(context, '/segments/owned');
    }
  },
});
