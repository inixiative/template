/**
 * @atlas
 * @kind utils
 * @partOf primitive:ui
 * @uses none
 */
import { redirect } from '@tanstack/react-router';
import { TWO_FACTOR_SETUP_PATH } from '@template/ui/lib/routeRedirect';
import {
  buildPathWithSearch,
  pickSearchParams,
  searchParamValue,
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

    if (
      currentAppStore().auth.twoFactorAction &&
      context?.location.pathname !== TWO_FACTOR_SETUP_PATH
    ) {
      const { pathname = '/dashboard', search, hash } = context?.location ?? {};
      const redirectTo = buildPathWithSearch(pathname, search, hash);
      throw redirect({
        to: TWO_FACTOR_SETUP_PATH,
        search: { redirectTo },
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
      const redirectTo = searchParamValue(search, 'redirectTo') || '/dashboard';

      throw redirect({
        to: redirectTo,
      });
    }
  },
});
