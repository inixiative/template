/**
 * @atlas
 * @kind config
 * @partOf infrastructure:env
 * @uses primitive:shared
 */
import { encryptionEnv } from '@template/db/lib/encryption/envValidation';
import { type EnvOverrideParser, isTest, wrapEnvWithOverrides } from '@template/shared/utils';
import { z } from 'zod';

const { fields: encryptionFields, applyRefinements: applyEncryptionRefinements } = encryptionEnv();

const jobEnvFields = {
  JOBS_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(10),
  JOBS_MAX_QUEUE_DEPTH: z.coerce.number().int().positive().default(10_000),
  JOBS_OUTBOX_FLUSH_MAX_ROWS: z.coerce.number().int().positive().default(1000),
  JOBS_OUTBOX_FLUSH_LINGER_MS: z.coerce.number().int().nonnegative().default(200),
  JOBS_OVERFLOW_STUCK_MS: z.coerce.number().int().positive().default(300_000),
  JOBS_OVERFLOW_TTL_MS: z.coerce.number().int().positive().default(60_000),
  JOBS_OUTBOX_MAX_SLOW_ADMISSIONS: z.coerce.number().int().nonnegative().default(100),
  BULK_SLOT_FRACTION: z.coerce.number().min(0).max(1).default(0.5),
  BULK_SLOTS: z.coerce.number().int().positive().optional(),
  BULK_LEASE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  EMAIL_SLOW_LANE_MIN_RECIPIENTS: z.coerce.number().int().nonnegative().default(25),
};

const parseJobEnvOverride: EnvOverrideParser = (key, override, current) => {
  if (!(key in jobEnvFields)) return override;
  const parsedOverride = jobEnvFields[key as keyof typeof jobEnvFields].safeParse(override);
  return parsedOverride.success ? parsedOverride.data : current;
};

const preprocessEnv = (env: Record<string, string | undefined>): Record<string, string | undefined> => {
  return Object.fromEntries(
    Object.entries(env).filter(
      ([key, value]) => value !== '' || (key.startsWith('OTEL_EXPORTER_OTLP_') && key.endsWith('_HEADERS')),
    ),
  );
};

// .passthrough() so unknown keys (NODE_ENV, PROJECT_NAME, etc.) survive — we
// replace process.env with the parsed object below.
const baseEnvSchema = z
  .object({
    // Core (required)
    ENVIRONMENT: z.enum(['local', 'pr', 'staging', 'prod', 'test']),
    DATABASE_URL: z.string(),
    BETTER_AUTH_SECRET: z.string().min(32),
    REDIS_URL: z.string(),
    REDIS_BULLMQ_URL: z.string().optional(),

    // Core (defaults)
    PORT: z.coerce.number().default(8000),
    LOG_LEVEL: z.enum(['silent', 'fatal', 'error', 'warn', 'log', 'info', 'debug', 'trace', 'verbose']).optional(),

    // URLs
    API_URL: z.string().url(),
    WEB_URL: z.string().url().optional(),
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
    OTEL_ENABLED: z.enum(['true', 'false']).optional(),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
    OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
    OTEL_SERVICE_NAME: z.string().optional(),

    // BullBoard
    BULL_BOARD_USERNAME: z.string().optional(),
    BULL_BOARD_PASSWORD: z.string().optional(),

    // Job tuning
    AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(2555),
    ...jobEnvFields,

    // Stripe (optional integration)
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),

    // Encryption (for sensitive data at rest) — derived from ENCRYPTED_MODELS registry
    ...encryptionFields,
  })
  .passthrough();

const envSchema = applyEncryptionRefinements(baseEnvSchema);

// Extend ProcessEnv with our schema types
export type Env = z.infer<typeof envSchema>;
declare global {
  namespace NodeJS {
    interface ProcessEnv extends Env {}
  }
}

// Cast/default whatever's present. In test, required-but-missing vars stay
// undefined (tests opt in to the ones they need); in non-test, the strict
// schema throws on missing requireds.
const parsed = isTest
  ? baseEnvSchema.partial().parse(preprocessEnv(process.env))
  : envSchema.parse(preprocessEnv(process.env));
// In test the parsed env is wrapped so setEnvOverride/withEnv overrides win over reads.
process.env = (isTest ? wrapEnvWithOverrides(parsed, parseJobEnvOverride) : parsed) as unknown as NodeJS.ProcessEnv;
