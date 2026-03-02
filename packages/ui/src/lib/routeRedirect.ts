import { redirect } from '@tanstack/react-router';
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

const navigateToAuth = (path: '/login' | '/signup', getStore: () => AppStore, preserveSearch?: boolean) => {
  const redirectTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const searchAndHash = `${window.location.search}${window.location.hash}`;
  const query = preserveSearch ? searchAndHash : `?redirectTo=${encodeURIComponent(redirectTo)}`;
  getStore().navigation.navigatePreservingContext(`${path}${query}`);
};

export const navigateToLogin = (getStore: () => AppStore, preserveSearch?: boolean) =>
  navigateToAuth('/login', getStore, preserveSearch);

export const navigateToSignup = (getStore: () => AppStore, preserveSearch?: boolean) =>
  navigateToAuth('/signup', getStore, preserveSearch);
