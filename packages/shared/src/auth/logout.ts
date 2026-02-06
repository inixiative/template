import { useAppStore } from '../store';
import { createAuthClient } from '../lib/createAuthClient';

export async function logout(baseURL: string) {
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
}
