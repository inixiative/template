import { isTest } from '@template/shared/utils';
import { z } from 'zod';

const preprocessEnv = (env: Record<string, string | undefined>): Record<string, string | undefined> => {
  return Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
};

const envSchema = z.object({
  // Core (required)
  ENVIRONMENT: z.enum(['local', 'develop', 'staging', 'production', 'test']),
  DATABASE_URL: z.string(),
  BETTER_AUTH_SECRET: z.string().min(32),
  REDIS_URL: z.string(),

  // Core (defaults)
  PORT: z.coerce.number().default(8000),
  LOG_LEVEL: z.enum(['silent', 'fatal', 'error', 'warn', 'log', 'info', 'debug', 'trace', 'verbose']).optional(),

  // URLs
  API_URL: z.string(),
  WEB_URL: z.string(),
  ADMIN_URL: z.string().optional(),
  SUPERADMIN_URL: z.string().optional(),

  // Auth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Webhooks (required)
  WEBHOOK_SIGNING_PRIVATE_KEY: z.string(),
  WEBHOOK_SIGNING_PUBLIC_KEY: z.string(),

  // Sentry (optional integration)
  SENTRY_ENABLED: z.coerce.boolean().default(false),
  SENTRY_DSN: z.string().optional(),

  // OTEL (optional integration)
  OTEL_ENABLED: z.coerce.boolean().default(false),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().optional(),

  // BullBoard
  BULL_BOARD_USERNAME: z.string().optional(),
  BULL_BOARD_PASSWORD: z.string().optional(),

  // AWS S3 (optional integration)
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET_NAME: z.string().optional(),
  CLOUDFRONT_URL: z.string().optional(),

  // Stripe (optional integration)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

// Extend ProcessEnv with our schema types
export type Env = z.infer<typeof envSchema>;
declare global {
  namespace NodeJS {
    interface ProcessEnv extends Env {}
  }
}

// Validate and assign - throws if invalid (skip in test mode)
if (!isTest) process.env = envSchema.parse(preprocessEnv(process.env)) as unknown as NodeJS.ProcessEnv;
