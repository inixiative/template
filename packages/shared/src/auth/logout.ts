import { createAuthClient } from '@template/shared/lib/createAuthClient';
import { useAppStore } from '@template/shared/store';

export const logout = async (baseURL: string) => {
  const queryClient = useAppStore.getState().api.queryClient;
  const clearAuth = useAppStore.getState().auth.logout;
  const clearPermissions = useAppStore.getState().permissions.clear;

  try {
    const authClient = createAuthClient(baseURL);
    await authClient.signOut();
    queryClient.clear();
    clearAuth();
    clearPermissions();
  } catch (error) {
    clearAuth();
    clearPermissions();
    throw error;
  }
};
