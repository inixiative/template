import { createRootRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { RootNotFound, useDarkMode, useLanguage, useSpaceTheme, useThemePersistence } from '@template/ui';
import { usePageMeta } from '@template/shared';
import { useEffect } from 'react';
import { useAppStore } from '#/store';
import { navConfig } from '#/config/nav';

const RootComponent = () => {
  const navigate = useNavigate();
  const theme = useAppStore((state) => state.ui.theme);
  const pageSpace = useAppStore((state) => state.tenant.page.space);
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

  // TODO: Remove mock theme once database schema is ready
  const mockSpaceTheme = {
    primary: "262 80% 46%",      // Purple
    secondary: "142 76% 46%",    // Green
    tertiary: "199 89% 48%",     // Blue
    quaternary: "174 72% 56%",   // Teal
    accent: "38 92% 50%",        // Orange
    logo: "https://via.placeholder.com/200x50/8b5cf6/ffffff?text=AdminLogo",
  };

  const spaceTheme = pageSpace ? mockSpaceTheme : null;

  useDarkMode(theme);
  useSpaceTheme(spaceTheme);

  return <Outlet />;
};

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: RootNotFound,
});
