import { useSearch } from '@tanstack/react-router';
import type { AuthSession, AuthUser } from '@template/shared/auth/types';
import type { AuthClient } from '@template/shared/lib/createAuthClient';
import { SignupForm } from '@template/ui/components/auth/SignupForm';
import { useState } from 'react';

type SignupPageProps = {
  authClient: AuthClient;
  onSuccess: (user: AuthUser, session: AuthSession) => void;
};

export const SignupPage = ({ authClient, onSuccess }: SignupPageProps) => {
  const search = useSearch({ strict: false }) as { redirectTo?: string };
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async (email: string, password: string, name: string) => {
    setError(undefined);
    setIsLoading(true);

    try {
      const result = await authClient.signUp({
        email,
        password,
        name,
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
      <SignupForm
        onSubmit={handleSignup}
        onLoginClick={() => window.location.assign('/login')}
        error={error}
        isLoading={isLoading}
      />
    </div>
  );
};
