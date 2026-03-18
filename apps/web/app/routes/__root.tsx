import { createRootRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { RootNotFound, RouteError, Toaster } from '@template/ui/components';
import { useDarkMode, useLanguage, usePageMeta, useSpaceTheme, useThemePersistence } from '@template/ui/hooks';
import { useAppStore } from '@template/ui/store';
import { useLayoutEffect } from 'react';
import { navConfig } from '#/config/nav';

const RootComponent = () => {
  const navigate = useNavigate();
  const theme = useAppStore((state) => state.ui.theme);
  const pageSpace = useAppStore((state) => state.tenant.page.space);
  const setNavigate = useAppStore((state) => state.navigation.setNavigate);
  const setNavConfig = useAppStore((state) => state.navigation.setNavConfig);

  // Initialize navigation in store synchronously before paint
  // navigate, setNavigate, setNavConfig are all stable refs
  useLayoutEffect(() => {
    setNavigate(navigate);
    setNavConfig(navConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, setNavConfig, setNavigate]);

  usePageMeta();
  useLanguage();
  useThemePersistence();

  // TODO: Remove mock theme once database schema is ready
  const mockSpaceTheme = {
    primary: '262 80% 46%', // Purple
    secondary: '142 76% 46%', // Green
    tertiary: '199 89% 48%', // Blue
    quaternary: '174 72% 56%', // Teal
    accent: '38 92% 50%', // Orange
    logo: 'https://via.placeholder.com/200x50/8b5cf6/ffffff?text=SpaceLogo',
  };

  const spaceTheme = pageSpace ? mockSpaceTheme : null;

  useDarkMode(theme);
  useSpaceTheme(spaceTheme);

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
