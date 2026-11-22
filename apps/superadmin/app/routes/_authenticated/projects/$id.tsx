/**
 * @atlas
 * @kind page
 * @partOf feature:project
 * @uses primitive:ui
 */
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { redirectPreservingContext } from '@template/ui/lib';

export const Route = createFileRoute('/_authenticated/projects/$id')({
  beforeLoad: (context) => {
    const id = context.params.id;
    if (
      context.location.pathname === `/projects/${id}` ||
      context.location.pathname === `/projects/${id}/`
    ) {
      redirectPreservingContext(context, `/projects/${id}/settings`);
    }
  },
  component: Outlet,
});
