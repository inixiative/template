import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { useAppStore } from '@template/ui/store';

const PublicLayout = () => {
  const appName = useAppStore((state) => state.ui.appName);

  return (
    <div className="h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-xl font-bold">
              Template <span className="text-muted-foreground font-normal">{appName}</span>
            </Link>
            <nav className="flex gap-6">
              <a
                href={import.meta.env.VITE_ADMIN_URL}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Admin
              </a>
              <Link to="/signup" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Sign Up
              </Link>
              <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Log In
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
};

export const Route = createFileRoute('/_public')({
  component: PublicLayout,
});
