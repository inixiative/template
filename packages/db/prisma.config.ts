import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma/schema'),

  // Required for db push
  datasource: {
    url: process.env.DATABASE_URL,
  },

  migrate: {
    async url() {
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required. Run commands via: bun run with <env> api <command>');
      }
      return process.env.DATABASE_URL;
    },
  },
});
