/**
 * @atlas
 * @kind utils
 * @partOf primitive:ui
 * @uses none
 */
import { redirect } from '@tanstack/react-router';
import { currentLocation, currentPath } from '@template/ui/lib/currentLocation';
import { pickSearchParams } from '@template/ui/lib/searchParams';
import type { AppStore } from '@template/ui/store/types';

type BeforeLoadContext = {
  location: {
    search: Record<string, unknown>;
    hash?: string;
  };
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
