import { createRootRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { RootNotFound, Toaster } from '@template/ui/components';
import { useDarkMode, useLanguage, usePageMeta, useThemePersistence } from '@template/ui/hooks';
import { useLayoutEffect } from 'react';
import { useAppStore } from '@template/ui/store';
import { navConfig } from '#/config/nav';

const RootComponent = () => {
  const navigate = useNavigate();
  const theme = useAppStore((state) => state.ui.theme);
  const setNavigate = useAppStore((state) => state.navigation.setNavigate);
  const setNavConfig = useAppStore((state) => state.navigation.setNavConfig);

  // Initialize navigation in store synchronously before paint
  // navigate, setNavigate, setNavConfig are all stable refs
  useLayoutEffect(() => {
    setNavigate(navigate);
    setNavConfig(navConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  usePageMeta();
  useLanguage();
  useThemePersistence();

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
});
