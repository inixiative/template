/**
 * @atlas
 * @kind utils
 * @partOf primitive:ui
 * @uses none
 */
import { redirect } from '@tanstack/react-router';
import { isAppPath } from '@template/shared/utils/isAppPath';
import { currentLocation, currentPath } from '@template/ui/lib/currentLocation';
import { pickSearchParams } from '@template/ui/lib/searchParams';
import type { AppStore } from '@template/ui/store/types';

export const TWO_FACTOR_PATH = '/two-factor';
export const PRESERVED_REDIRECT_PARAMS = ['org', 'space', 'spoof', 'flow'] as const;

const NON_RETURN_AUTH_PATHS = ['/login', '/signup', TWO_FACTOR_PATH] as const;

type BeforeLoadContext = {
  location: {
    pathname: string;
    search: Record<string, unknown>;
    hash?: string;
  };
};

export const safeInternalRedirect = (
  value: string | undefined,
  fallback = '/dashboard',
): string => {
  if (!value || !isAppPath(value)) return fallback;
  const parsed = new URL(value, 'http://localhost');
  if (
    NON_RETURN_AUTH_PATHS.some(
      (path) => parsed.pathname === path || parsed.pathname.startsWith(`${path}/`),
    )
  ) {
    return fallback;
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
};

export const redirectPreservingContext = (context: BeforeLoadContext, to: string): never => {
  const preserved = pickSearchParams(context.location.search, PRESERVED_REDIRECT_PARAMS);
  throw redirect({ to, search: preserved });
};

const navigateToAuth = (
  path: '/login' | '/signup',
  currentAppStore: () => AppStore,
  preserveSearch?: boolean,
) => {
  const redirectTo = currentPath();
  const { search, hash } = currentLocation();
  const searchAndHash = `${search}${hash}`;
  const query = preserveSearch ? searchAndHash : `?redirectTo=${encodeURIComponent(redirectTo)}`;
  currentAppStore().navigation.navigateKeepingSearchParams(`${path}${query}`, 'all');
};

export const navigateToLogin = (currentAppStore: () => AppStore, preserveSearch?: boolean) =>
  navigateToAuth('/login', currentAppStore, preserveSearch);

export const navigateToSignUp = (currentAppStore: () => AppStore, preserveSearch?: boolean) =>
  navigateToAuth('/signup', currentAppStore, preserveSearch);

export const navigateToTwoFactorReverify = (currentAppStore: () => AppStore): void => {
  if (currentLocation().pathname === TWO_FACTOR_PATH) return;
  const redirectTo = currentPath();
  const params = new URLSearchParams({ mode: 'reverify', redirectTo });
  currentAppStore().navigation.navigateKeepingSearchParams(
    `${TWO_FACTOR_PATH}?${params.toString()}`,
    'context',
  );
};
