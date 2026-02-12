import { redirect } from '@tanstack/react-router';
import { buildPathWithSearch, pickSearchParams, readSearchParam } from '@template/ui/lib/searchParams';
import type { AppStore } from '@template/ui/store';

type BeforeLoadContext = {
  location: {
    pathname: string;
    search: Record<string, unknown>;
  };
};

export const createAuthGuards = (getStore: () => AppStore) => ({
  requireAuth: async (context?: BeforeLoadContext) => {
    try {
      await getStore().auth.initialize();
    } catch {
      // Ignore initialization errors - redirect handles unauthenticated state
    }

    if (!getStore().auth.isAuthenticated) {
      const pathname = context?.location.pathname || '/dashboard';
      const search = context?.location.search;
      const preserved = pickSearchParams(search, ['org', 'space', 'spoof']);
      const redirectTo = buildPathWithSearch(pathname, preserved);

      throw redirect({
        to: '/login',
        search: { redirectTo },
      });
    }
  },

  requirePublic: async (context?: BeforeLoadContext) => {
    try {
      await getStore().auth.initialize();
    } catch {
      // Ignore initialization errors - unauthenticated users pass
    }

    if (getStore().auth.isAuthenticated) {
      const search = context?.location.search;
      const redirectTo = readSearchParam(search, 'redirectTo') || '/dashboard';

      throw redirect({
        to: redirectTo,
      });
    }
  },
});
