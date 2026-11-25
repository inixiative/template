/**
 * @atlas
 * @kind utils
 * @partOf primitive:ui
 * @uses none
 */
import { redirect } from '@tanstack/react-router';
import {
  PRESERVED_REDIRECT_PARAMS,
  safeInternalRedirect,
  TWO_FACTOR_PATH,
} from '@template/ui/lib/routeRedirect';
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

const redirectWithReturnPath = (
  to: '/login' | typeof TWO_FACTOR_PATH,
  context?: BeforeLoadContext,
): never => {
  const { pathname = '/dashboard', search, hash } = context?.location ?? {};
  const redirectTo = buildPathWithSearch(pathname, search, hash);
  const preserved = pickSearchParams(search, PRESERVED_REDIRECT_PARAMS);
  throw redirect({
    to,
    search: { redirectTo, ...preserved },
  });
};

const redirectToInternalPath = (
  rawPath: string | null | undefined,
  currentSearch?: Record<string, unknown>,
): never => {
  const safe = safeInternalRedirect(rawPath ?? undefined);
  const parsed = new URL(safe, 'http://localhost');
  const preserved = pickSearchParams(currentSearch, PRESERVED_REDIRECT_PARAMS);
  const targetSearch: Record<string, string> = { ...preserved };
  for (const [key, value] of parsed.searchParams.entries()) {
    targetSearch[key] = value;
  }
  const hash = parsed.hash ? parsed.hash.slice(1) : undefined;
  throw redirect({
    to: parsed.pathname,
    search: Object.keys(targetSearch).length > 0 ? targetSearch : undefined,
    ...(hash ? { hash } : {}),
  });
};

export const createAuthGuards = (currentAppStore: () => AppStore) => ({
  redirectToLoginUnlessAuthenticated: async (context?: BeforeLoadContext) => {
    try {
      await currentAppStore().auth.initialize();
    } catch {
      // Ignore initialization errors - redirect handles unauthenticated state
    }

    if (!currentAppStore().auth.isAuthenticated) {
      redirectWithReturnPath('/login', context);
    }

    if (currentAppStore().auth.twoFactorAction && context?.location.pathname !== TWO_FACTOR_PATH) {
      redirectWithReturnPath(TWO_FACTOR_PATH, context);
    }
  },

  redirectUnlessTwoFactorRequired: async (context?: BeforeLoadContext) => {
    try {
      await currentAppStore().auth.initialize();
    } catch {
      // Ignore initialization errors - redirect handles unauthenticated state
    }

    if (!currentAppStore().auth.isAuthenticated) {
      redirectWithReturnPath('/login', context);
    }

    const search = context?.location.search;
    const isReverify = searchParamValue(search, 'mode') === 'reverify';
    if (!currentAppStore().auth.twoFactorAction && !isReverify) {
      redirectToInternalPath(searchParamValue(search, 'redirectTo'), search);
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
      const redirectTo = safeInternalRedirect(searchParamValue(search, 'redirectTo') ?? undefined);
      const preserved = pickSearchParams(search, PRESERVED_REDIRECT_PARAMS);

      if (currentAppStore().auth.twoFactorAction) {
        throw redirect({
          to: TWO_FACTOR_PATH,
          search: { redirectTo, ...preserved },
        });
      }

      redirectToInternalPath(redirectTo, search);
    }
  },
});
