import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { ErrorBoundary, RouteError } from '@template/ui/components';
import { useAppStore } from '@template/ui/store';

const PublicLayout = () => {
  const appName = useAppStore((state) => state.ui.appName);
  const projectName = useAppStore((state) => state.ui.projectName);
  const webUrl = import.meta.env.VITE_WEB_URL as string | undefined;

  return (
    <div className="h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-xl font-bold">
              {projectName} <span className="text-muted-foreground font-normal">{appName}</span>
            </Link>
            <nav className="flex gap-6">
              {webUrl && (
                <a
                  href={webUrl}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Web
                </a>
              )}
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
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
};

export const Route = createFileRoute('/_public')({
  component: PublicLayout,
  errorComponent: ({ error }) => <RouteError error={error} />,
});
