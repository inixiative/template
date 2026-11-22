/**
 * @atlas
 * @kind utils
 * @partOf primitive:ui
 * @uses none
 */
import { redirect } from '@tanstack/react-router';
import type { TwoFactorAction } from '@template/shared/auth/twoFactor';
import { isAppPath } from '@template/shared/utils/isAppPath';
import { currentLocation, currentPath } from '@template/ui/lib/currentLocation';
import { pickSearchParams } from '@template/ui/lib/searchParams';
import type { AppStore } from '@template/ui/store/types';

export const TWO_FACTOR_SETUP_PATH = '/settings/profile';

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
    parsed.pathname === TWO_FACTOR_SETUP_PATH ||
    parsed.pathname.startsWith(`${TWO_FACTOR_SETUP_PATH}/`)
  )
    return fallback;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
};

export const redirectPreservingContext = (context: BeforeLoadContext, to: string): never => {
  const preserved = pickSearchParams(context.location.search, ['org', 'space', 'spoof']);
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

export const navigateToTwoFactorSetup = (
  action: TwoFactorAction,
  currentAppStore: () => AppStore,
): void => {
  const store = currentAppStore();
  store.auth.setTwoFactorAction(action);
  const { pathname } = currentLocation();
  if (pathname === TWO_FACTOR_SETUP_PATH) return;
  const redirectTo = currentPath();
  store.navigation.navigate?.({
    to: TWO_FACTOR_SETUP_PATH,
    search: { redirectTo },
    replace: true,
  });
};
