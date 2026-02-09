import type { AuthClient } from '@template/shared/lib/createAuthClient';
import { useCallback, useState } from 'react';

export const useLogout = (authClient: AuthClient, onSuccess?: () => void) => {
  const [isLoading, setIsLoading] = useState(false);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authClient.signOut();
      onSuccess?.();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [authClient, onSuccess]);

  return { logout, isLoading };
};
