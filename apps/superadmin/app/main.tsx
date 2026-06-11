/**
 * @atlas
 * @kind entrypoint
 * @partOf superadmin
 * @uses primitive:ui
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { createAppQueryClient } from '@template/ui/lib/createAppQueryClient';
import { useAppStore } from '@template/ui/store';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { routeTree } from '#/routeTree.gen';
import '@template/shared/styles/theme.css';

const router = createRouter({ routeTree });
const queryClient = createAppQueryClient();
useAppStore.getState().setClient(queryClient);

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
