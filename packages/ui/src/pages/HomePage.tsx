import { buttonVariants } from '@template/ui/components/primitives/Button';
import { useAppStore } from '@template/ui/store';

type HomePageProps = {
  subtitle?: string;
  showSignup?: boolean;
};

export const HomePage = ({ subtitle, showSignup = true }: HomePageProps) => {
  const appName = useAppStore((state) => state.ui.appName);

  return (
    <div className="h-full flex items-center justify-center p-4 bg-gradient-to-br from-muted via-background to-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">
          Template <span className="text-muted-foreground font-normal">{appName}</span>
        </h1>
        {subtitle && <p className="text-muted-foreground mb-8">{subtitle}</p>}
        <div className="flex gap-4 justify-center">
          <a href="/login" className={buttonVariants()}>
            Log In
          </a>
          {showSignup ? (
            <a href="/signup" className={buttonVariants({ variant: 'outline' })}>
              Sign Up
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
};
