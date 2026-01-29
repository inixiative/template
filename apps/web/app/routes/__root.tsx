import { createRootRoute, Outlet } from '@tanstack/react-router';
import { useEffect } from 'react';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  // TODO: Get from user preferences, API, or browser
  const lang = navigator.language.split('-')[0] || 'en';

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return <Outlet />;
}
