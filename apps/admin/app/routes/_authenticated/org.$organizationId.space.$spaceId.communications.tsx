import { createFileRoute } from '@tanstack/react-router';
import { Card, CardHeader, CardTitle, CardContent } from '@template/ui';

export const Route = createFileRoute('/_authenticated/org/$organizationId/space/$spaceId/communications')({
  component: SpaceCommunicationsPage,
});

function SpaceCommunicationsPage() {
  const { organizationId, spaceId } = Route.useParams();

  return (
    <div className="p-8">
      <Card>
        <CardHeader>
          <CardTitle>Space Communications</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Email templates and notification settings for this space coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
