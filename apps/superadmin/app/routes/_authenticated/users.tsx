import { createFileRoute } from '@tanstack/react-router';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@template/ui';
import { UserPlus } from 'lucide-react';

const UsersPage = () => {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Platform Users</h1>
          <p className="text-muted-foreground">View and manage all users across the platform</p>
        </div>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">User management coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export const Route = createFileRoute('/_authenticated/users')({
  component: UsersPage,
});
