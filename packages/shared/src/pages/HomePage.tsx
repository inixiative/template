import { buttonVariants } from '@template/ui/components/Button';

type HomePageProps = {
  title: string;
  subtitle: string;
  showSignup?: boolean;
};

export const HomePage = ({ title, subtitle, showSignup = true }: HomePageProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">{title}</h1>
        <p className="text-muted-foreground mb-8">{subtitle}</p>
        <div className="flex gap-4 justify-center">
          <a href="/login" className={buttonVariants()}>
            Login
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
