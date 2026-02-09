import { useSearch } from '@tanstack/react-router';
import type { AuthSession, AuthUser } from '@template/shared/auth/types';
import type { AuthClient } from '@template/shared/lib/createAuthClient';
import { LoginForm } from '@template/ui/components/auth/LoginForm';
import { useState } from 'react';

type LoginPageProps = {
  authClient: AuthClient;
  onSuccess: (user: AuthUser, session: AuthSession) => void;
  hideSignup?: boolean;
};

export const LoginPage = ({ authClient, onSuccess, hideSignup }: LoginPageProps) => {
  const search = useSearch({ strict: false }) as { redirectTo?: string };
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (email: string, password: string) => {
    setError(undefined);
    setIsLoading(true);

    try {
      const result = await authClient.signIn({
        email,
        password,
      });
      onSuccess(result.user, result.session);
      window.location.assign(search.redirectTo || '/dashboard');
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
        onSignupClick={hideSignup ? undefined : () => window.location.assign('/signup')}
        error={error}
        isLoading={isLoading}
      />
    </div>
  );
};
