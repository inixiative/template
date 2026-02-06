import { useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { SignupForm } from '../components/auth/SignupForm';
import type { AuthClient, AuthUser, AuthSession } from '../auth/types';

type SignupPageProps = {
  authClient: AuthClient;
  onSuccess: (user: AuthUser, session: AuthSession) => void;
};

export const SignupPage = ({ authClient, onSuccess }: SignupPageProps) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { redirectTo?: string };
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async (email: string, password: string, name: string) => {
    setError(undefined);
    setIsLoading(true);

    try {
      const result = await authClient.signUp.email({
        email,
        password,
        name,
      });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      onSuccess(result.data?.user, result.data?.session);
      navigate({ to: search.redirectTo || '/dashboard' });
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <SignupForm
        onSubmit={handleSignup}
        onLoginClick={() => navigate({
          to: '/login',
          search: search.redirectTo ? { redirectTo: search.redirectTo } : undefined,
        })}
        error={error}
        isLoading={isLoading}
      />
    </div>
  );
};
