/**
 * @atlas
 * @kind page
 * @partOf feature:project
 * @uses primitive:ui
 */
import { createFileRoute } from '@tanstack/react-router';
import { ProjectDetailPage } from '@template/ui/pages';

const ProjectIntegrationsRoute = () => {
  const { id } = Route.useParams();
  return <ProjectDetailPage projectId={id} view="integrations" />;
};

export const Route = createFileRoute('/_authenticated/projects/$id/integrations')({
  component: ProjectIntegrationsRoute,
});
