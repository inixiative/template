import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@template/ui';

const SpaceCommunicationsPage = () => {
  const { spaceId } = Route.useParams();

  return (
    <div className="p-8">
      <Card>
        <CardHeader>
          <CardTitle>Space Communications</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Email templates and notification settings for this space coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export const Route = createFileRoute('/_authenticated/space/$spaceId/communications')({
  component: SpaceCommunicationsPage,
});
