import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')(
  {
    component: AdminDashboard,
  },
);

function AdminDashboard() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Admin</h1>
        <p className="text-muted-foreground">Organization management dashboard</p>
      </div>
    </div>
  );
}
