import { useState } from 'react';
import { useSearch } from '@tanstack/react-router';
import { useAppStore } from '@template/ui/store';

type AuthCredentials = Record<string, any>;

export const useAuthFlow = (authFn: (credentials: AuthCredentials) => Promise<void>) => {
  const search = useSearch({ strict: false }) as { redirectTo?: string };
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useAppStore((state) => state.navigation.navigate);

  const handleAuth = async (credentials: AuthCredentials) => {
    setError(undefined);
    setIsLoading(true);

    try {
      await authFn(credentials);
      navigate?.({ to: search.redirectTo || '/dashboard' });
    } catch (err: any) {
      setError(err?.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return { handleAuth, error, isLoading };
};
