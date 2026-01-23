import 'src/config/loadEnv.ts'
import { EnvSchema } from 'src/config/envSchema.ts'
import { Elysia } from 'elysia'
import { plugins } from 'src/plugins';

export const base = new Elysia({ name: 'base' })
  .env(EnvSchema)
  .use(plugins);
