import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Default for local development (matches docker-compose.yml)
const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/template';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma/schema'),

  // Required for db push
  datasource: {
    url: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
  },

  migrate: {
    async url() {
      return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
    },
  },
});
