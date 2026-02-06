import { createFileRoute } from '@tanstack/react-router';
import { Card, CardHeader, CardTitle, CardContent } from '@template/ui';

export const Route = createFileRoute('/_authenticated/communications')({
  component: CommunicationsPage,
});

function CommunicationsPage() {
  return (
    <div className="p-8">
      <Card>
        <CardHeader>
          <CardTitle>Communications</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Email preferences and notifications coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
