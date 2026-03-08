import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { useAppStore } from '@template/ui/store';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { routeTree } from '#/routeTree.gen';
import '@template/shared/styles/theme.css';

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const App = () => {
  const queryClient = useAppStore((state) => state.client);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
