/**
 * @atlas
 * @kind config
 * @partOf primitive:sdk
 */
import { defineConfig } from '@hey-api/openapi-ts';

const apiUrl = process.env.VITE_API_URL || 'http://localhost:8000';
const input = process.env.OPENAPI_SPEC_PATH || `${apiUrl}/openapi/docs`;

export default defineConfig({
  client: '@hey-api/client-fetch',
  input,
  output: {
    // Generated code owns this subfolder; clean wipes it on every regen. Hand-written
    // src/lenses + src/index.ts live beside it in src/ and are never touched. No biome
    // format/lint post-processing — the repo's biome config ignores **/generated.
    path: './src/generated',
  },
  logs: {
    level: 'warn',
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
