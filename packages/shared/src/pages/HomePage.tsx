import { Link } from '@tanstack/react-router';
import { buttonVariants } from '../components/Button';

type HomePageProps = {
  title: string;
  subtitle: string;
};

export const HomePage = ({ title, subtitle }: HomePageProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">{title}</h1>
        <p className="text-muted-foreground mb-8">{subtitle}</p>
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
};
