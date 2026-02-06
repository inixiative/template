import { useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { LoginForm } from '../components/auth/LoginForm';
import type { AuthClient, AuthUser, AuthSession } from '../auth/types';

type LoginPageProps = {
  authClient: AuthClient;
  onSuccess: (user: AuthUser, session: AuthSession) => void;
  hideSignup?: boolean;
};

export const LoginPage = ({ authClient, onSuccess, hideSignup }: LoginPageProps) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { redirectTo?: string };
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (email: string, password: string) => {
    setError(undefined);
    setIsLoading(true);

    try {
      const result = await authClient.signIn.email({
        email,
        password,
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
      <LoginForm
        onSubmit={handleLogin}
        onSignupClick={hideSignup ? undefined : () => navigate({
          to: '/signup',
          search: search.redirectTo ? { redirectTo: search.redirectTo } : undefined,
        })}
        error={error}
        isLoading={isLoading}
      />
    </div>
  );
};
