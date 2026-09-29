/**
 * @atlas
 * @kind page
 * @uses primitive:ui
 */
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { RootNotFound, RouteError, Toaster } from '@template/ui/components';
import {
  useApiWebsocket,
  useDarkMode,
  useLanguage,
  usePageMeta,
  useRegisterNavigation,
  useThemePersistence,
} from '@template/ui/hooks';
import { useAppStore } from '@template/ui/store';
import { navConfig } from '#/config/nav';

const RootComponent = () => {
  const theme = useAppStore((state) => state.ui.theme);

  useRegisterNavigation(navConfig);
  usePageMeta();
  useLanguage();
  useThemePersistence();
  useApiWebsocket();
  useDarkMode(theme);

  return (
    <>
      <Toaster />
      <Outlet />
    </>
  );
};

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: () => <RootNotFound />,
  errorComponent: ({ error }) => <RouteError error={error} />,
});
