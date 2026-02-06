import { defineConfig } from '@hey-api/openapi-ts';

const apiUrl = process.env.VITE_API_URL || 'http://localhost:8000';
const input = process.env.OPENAPI_SPEC_PATH || `${apiUrl}/openapi/docs`;

export default defineConfig({
  client: '@hey-api/client-fetch',
  input,
  output: {
    path: './src/apiClient',
    format: 'biome',
    lint: 'biome',
  },
  plugins: [
    '@hey-api/typescript',
    '@hey-api/schemas',
    {
      name: '@hey-api/sdk',
      asClass: false,
    },
    {
      name: '@tanstack/react-query',
      infiniteQueryOptions: true,
      queryOptions: true,
    },
  ],
});
