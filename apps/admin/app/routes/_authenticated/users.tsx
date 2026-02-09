import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/users')({
  component: UsersPage,
});

function UsersPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Users</h1>
      <p className="text-muted-foreground">User management for current context</p>
    </div>
  );
}
