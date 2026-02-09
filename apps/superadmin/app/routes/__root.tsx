import { createRootRoute, Outlet, useNavigate } from '@tanstack/router';
import { RootNotFound, useDarkMode, useLanguage, useThemePersistence } from '@template/ui';
import { usePageMeta } from '@template/shared';
import { useEffect } from 'react';
import { useAppStore } from '#/store';
import { navConfig } from '#/config/nav';

const RootComponent = () => {
  const navigate = useNavigate();
  const theme = useAppStore((state) => state.ui.theme);
  const setNavigate = useAppStore((state) => state.navigation.setNavigate);
  const setNavConfig = useAppStore((state) => state.navigation.setNavConfig);

  // Initialize navigation in store (one-time setup)
  // navigate, setNavigate, setNavConfig are all stable refs
  useEffect(() => {
    setNavigate((options: any) => navigate(options));
    setNavConfig(navConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  usePageMeta();
  useLanguage();
  useThemePersistence();

  useDarkMode(theme);

  return <Outlet />;
};

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: RootNotFound,
});
