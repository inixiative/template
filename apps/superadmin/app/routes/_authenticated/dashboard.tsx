import { createFileRoute } from '@tanstack/react-router';
import { Card, CardHeader, CardTitle, CardContent } from '@template/ui';

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Platform Operations</h1>
        <p className="text-muted-foreground">Manage the entire platform and system health</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">View and manage all organizations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Monitor system metrics and health</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Support Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Manage customer support requests</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
