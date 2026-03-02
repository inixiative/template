import { createFileRoute, Link } from '@tanstack/react-router';
import { Button, Card, CardHeader, CardTitle, CardContent } from '@template/ui';

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <nav className="flex items-center gap-4">
            <Link to="/profile" className="text-muted-foreground hover:text-foreground">
              Profile
            </Link>
            <Link to="/settings" className="text-muted-foreground hover:text-foreground">
              Settings
            </Link>
            <Button variant="ghost" size="sm">
              Logout
            </Button>
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Welcome back!</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">This is your dashboard. Content coming soon.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
