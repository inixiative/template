import { createFileRoute } from '@tanstack/react-router';
import { Card, CardHeader, CardTitle, CardContent } from '@template/ui';

export const Route = createFileRoute('/_authenticated/org/$organizationId/communications')({
  component: OrganizationCommunicationsPage,
});

function OrganizationCommunicationsPage() {
  const { organizationId } = Route.useParams();

  return (
    <div className="p-8">
      <Card>
        <CardHeader>
          <CardTitle>Organization Communications</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Email templates and notification settings for this organization coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
