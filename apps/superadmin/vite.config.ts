import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: './app/routes',
      generatedRouteTree: './app/routeTree.gen.ts',
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
    nodePolyfills({
      // Enable polyfills for Buffer and other Node.js APIs used by better-auth
      globals: {
        Buffer: true,
        process: true,
      },
    }),
  ],
  clearScreen: false,
  server: {
    port: 3002,
    watch: {
      ignored: ['**/routeTree.gen.ts'],
    },
  },
});
