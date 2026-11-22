/**
 * @atlas
 * @kind page
 * @partOf feature:project
 * @uses primitive:ui
 */
import { createFileRoute } from '@tanstack/react-router';
import { ProjectsPage } from '@template/ui/pages';

export const Route = createFileRoute('/_authenticated/projects/')({
  component: ProjectsPage,
});
