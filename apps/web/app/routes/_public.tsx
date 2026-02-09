import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router';
import { BookOpen } from 'lucide-react';

const PublicLayout = () => {
  const location = useLocation();

  const navItems = [
    { path: '/content', label: 'Content', icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-xl font-bold">
              Template
            </Link>
            <nav className="flex gap-6">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 text-sm transition-colors ${
                      isActive ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
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
