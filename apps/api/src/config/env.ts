/**
 * @atlas
 * @kind config
 * @partOf infrastructure:env
 * @uses primitive:shared
 */
import { encryptionEnv } from '@template/db/lib/encryption/envValidation';
import { isTest, wrapEnvWithOverrides } from '@template/shared/utils';
import { z } from 'zod';

const { fields: encryptionFields, applyRefinements: applyEncryptionRefinements } = encryptionEnv();

const preprocessEnv = (env: Record<string, string | undefined>): Record<string, string | undefined> => {
  return Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
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
    OTEL_ENABLED: z.coerce.boolean().default(false),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
    OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
    OTEL_SERVICE_NAME: z.string().optional(),

    // BullBoard
    BULL_BOARD_USERNAME: z.string().optional(),
    BULL_BOARD_PASSWORD: z.string().optional(),

    // Job tuning
    AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(2555),

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
process.env = (isTest ? wrapEnvWithOverrides(parsed) : parsed) as unknown as NodeJS.ProcessEnv;
