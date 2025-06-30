import { t } from 'elysia';

export enum Environment {
  local = 'local',
  test = 'test',
  development = 'development',
  staging = 'staging',
  sandbox = 'sandbox',
  production = 'production',
}

export const EnvSchema = t.Object({
  // App
  ENVIRONMENT: t.Enum(Environment),
  PORT: t.Numeric({ default: 8000 }),

  // Database
  DATABASE_URL: t.String(),
  
  // Auth
  GOOGLE_CLIENT_ID: t.Optional(t.String()),
  GOOGLE_CLIENT_SECRET: t.Optional(t.String()),
  WEB_URL: t.String({ default: 'http://localhost:3000' }),
  ADMIN_URL: t.String({ default: 'http://localhost:3001' }),
  BETTER_AUTH_SECRET: t.String(),
  
  // Plugin flags
  DB_ENABLED: t.Boolean({ default: true }),
  AUTH_ENABLED: t.Boolean({ default: true }),
  REDIS_ENABLED: t.Boolean({ default: true }),
  QUEUE_ENABLED: t.Boolean({ default: true }),
  
  // Middleware flags
  // EXAMPLE_MIDDLEWARE_ENABLED: t.Boolean({ default: true }),
  
  // Monitoring
  SENTRY_ENABLED: t.Boolean({ default: true }),
  SENTRY_DSN: t.Optional(t.String()),
});

export type Env = typeof EnvSchema.static;
