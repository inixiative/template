import { redirect } from '@tanstack/react-router';
import { buildPathWithSearch, pickSearchParams, readSearchParam } from '@template/ui/lib/searchParams';
import type { AppStore } from '@template/ui/store';

type BeforeLoadContext = {
  location: {
    pathname: string;
    search: Record<string, unknown>;
    hash: string;
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
      const { pathname = '/dashboard', search, hash } = context?.location ?? {};
      const redirectTo = buildPathWithSearch(pathname, search, hash);
      const loginParams = pickSearchParams(search, ['org', 'space', 'spoof']);

      throw redirect({
        to: '/login',
        search: { redirectTo, ...loginParams },
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
