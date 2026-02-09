import { createFileRoute, Link, Outlet } from '@tanstack/react-router';

const PublicLayout = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-xl font-bold">
              Template Admin
            </Link>
            <nav className="flex gap-6">
              <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Sign In
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
};

export const Route = createFileRoute('/_public')({
  component: PublicLayout,
});
