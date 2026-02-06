import { redirect } from '@tanstack/react-router';

type AuthStore = {
  auth: {
    isAuthenticated: boolean;
  };
};

type BeforeLoadContext = {
  location: {
    pathname: string;
    search: Record<string, unknown>;
  };
};

export const createAuthGuards = (getStore: () => AuthStore) => ({
  requireAuth: (context?: BeforeLoadContext) => {
    const isAuthenticated = getStore().auth.isAuthenticated;
    if (!isAuthenticated) {
      const redirectTo = context?.location.pathname || '/dashboard';
      throw redirect({
        to: '/login',
        search: { redirectTo },
      });
    }
  },

  requireGuest: (context?: BeforeLoadContext) => {
    const isAuthenticated = getStore().auth.isAuthenticated;
    if (isAuthenticated) {
      const redirectTo = (context?.location.search.redirectTo as string) || '/dashboard';
      throw redirect({ to: redirectTo });
    }
  },
});
