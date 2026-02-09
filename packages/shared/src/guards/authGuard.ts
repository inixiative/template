import { redirect } from '@tanstack/react-router';

type AuthStore = {
  auth: {
    isAuthenticated: boolean;
    isInitialized?: boolean;
    initialize?: () => Promise<unknown>;
  };
};

type BeforeLoadContext = {
  location: {
    pathname: string;
    search: Record<string, unknown>;
  };
};

export const createAuthGuards = (getStore: () => AuthStore) => ({
  requireAuth: async (context?: BeforeLoadContext) => {
    const store = getStore();
    if (!store.auth.isInitialized && store.auth.initialize) {
      try {
        await store.auth.initialize();
      } catch {
        // Ignore initialization errors here; redirect logic below handles unauthenticated state.
      }
    }

    const isAuthenticated = getStore().auth.isAuthenticated;
    if (!isAuthenticated) {
      const redirectTo = context?.location.pathname || '/dashboard';
      throw redirect({
        to: '/login',
        search: { redirectTo },
      });
    }
  },

  requireGuest: async (context?: BeforeLoadContext) => {
    const store = getStore();
    if (!store.auth.isInitialized && store.auth.initialize) {
      try {
        await store.auth.initialize();
      } catch {
        // Ignore initialization errors here; unauthenticated users should pass guest guard.
      }
    }

    const isAuthenticated = getStore().auth.isAuthenticated;
    if (isAuthenticated) {
      const redirectTo = (context?.location.search.redirectTo as string) || '/dashboard';
      throw redirect({ to: redirectTo });
    }
  },
});
