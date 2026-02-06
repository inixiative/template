import { createRootRoute, Outlet } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAppStore } from '#/store';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const lang = navigator.language.split('-')[0] || 'en';
  const theme = useAppStore((state) => state.ui.theme);
  const queryClient = useAppStore((state) => state.api.queryClient);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    }
  }, [theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
