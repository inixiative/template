/**
 * @atlas
 * @kind utils
 * @partOf primitive:ui
 * @uses none
 */
import { redirect } from '@tanstack/react-router';
import {
  buildPathWithSearch,
  pickSearchParams,
  readSearchParam,
} from '@template/ui/lib/searchParams';
import type { AppStore } from '@template/ui/store/types';

type BeforeLoadContext = {
  location: {
    pathname: string;
    search: Record<string, unknown>;
    hash: string;
  };
};

export const createAuthGuards = (currentAppStore: () => AppStore) => ({
  redirectToLoginUnlessAuthenticated: async (context?: BeforeLoadContext) => {
    try {
      await currentAppStore().auth.initialize();
    } catch {
      // Ignore initialization errors - redirect handles unauthenticated state
    }

    if (!currentAppStore().auth.isAuthenticated) {
      const { pathname = '/dashboard', search, hash } = context?.location ?? {};
      const redirectTo = buildPathWithSearch(pathname, search, hash);
      const loginParams = pickSearchParams(search, ['org', 'space', 'spoof']);

      throw redirect({
        to: '/login',
        search: { redirectTo, ...loginParams },
      });
    }
  },

  redirectAuthenticatedUserAwayFromPublicPage: async (context?: BeforeLoadContext) => {
    try {
      await currentAppStore().auth.initialize();
    } catch {
      // Ignore initialization errors - unauthenticated users pass
    }

    if (currentAppStore().auth.isAuthenticated) {
      const search = context?.location.search;
      const redirectTo = readSearchParam(search, 'redirectTo') || '/dashboard';

      throw redirect({
        to: redirectTo,
      });
    }
  },
});
