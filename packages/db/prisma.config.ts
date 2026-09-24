/**
 * @atlas
 * @kind config
 * @partOf infrastructure:prisma
 */
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
    // Schema changes use the owning role; services run as a role that cannot
    // drop or truncate. Falls back to DATABASE_URL where the split isn't set up.
    async url() {
      const url = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;
      if (!url) {
        throw new Error('DATABASE_URL is required. Run commands via: bun run with <env> api <command>');
      }
      return url;
    },
  },
});
