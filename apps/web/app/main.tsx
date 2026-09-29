/**
 * @atlas
 * @kind entrypoint
 * @uses primitive:ui
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { initializeBrowserTelemetry, reportBrowserError } from '@template/ui/lib/browserTelemetry';
import { createAppQueryClient } from '@template/ui/lib/createAppQueryClient';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { routeTree } from '#/routeTree.gen';
import '@template/shared/styles/theme.css';

void initializeBrowserTelemetry('web');

const router = createRouter({ routeTree });
const queryClient = createAppQueryClient();

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

createRoot(document.getElementById('root')!, {
  onCaughtError: reportBrowserError,
  onUncaughtError: reportBrowserError,
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
