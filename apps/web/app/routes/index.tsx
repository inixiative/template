import { createFileRoute, Link } from '@tanstack/react-router';
import { buttonVariants } from '@template/ui';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Template</h1>
        <p className="text-muted-foreground mb-8">TanStack Start + React Aria + Tailwind</p>
        <div className="flex gap-4 justify-center">
          <Link to="/login" className={buttonVariants()}>
            Login
          </Link>
          <Link to="/signup" className={buttonVariants({ variant: 'outline' })}>
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
