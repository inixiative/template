/**
 * Environment configuration with validation.
 *
 * Note: Empty strings from Docker/CI are treated as undefined.
 */
const getEnv = () => {
  // Helper to convert empty strings to undefined
  const str = (val: string | undefined) => (val === '' ? undefined : val);

  const NODE_ENV = process.env.NODE_ENV || 'development';
  const ENVIRONMENT = process.env.ENVIRONMENT || 'local';

  return {
    // Core
    NODE_ENV,
    ENVIRONMENT,
    PORT: Number(process.env.PORT) || 8000,
    DATABASE_URL: process.env.DATABASE_URL || '',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

    // Auth (BetterAuth)
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || 'dev-secret-change-in-production',
    API_URL: process.env.API_URL || 'http://localhost:8000',
    GOOGLE_CLIENT_ID: str(process.env.GOOGLE_CLIENT_ID),
    GOOGLE_CLIENT_SECRET: str(process.env.GOOGLE_CLIENT_SECRET),

    // Sentry (optional)
    SENTRY_DSN: str(process.env.SENTRY_DSN),

    // AWS S3 (optional - for document storage)
    AWS_REGION: str(process.env.AWS_REGION),
    AWS_ACCESS_KEY_ID: str(process.env.AWS_ACCESS_KEY_ID),
    AWS_SECRET_ACCESS_KEY: str(process.env.AWS_SECRET_ACCESS_KEY),
    S3_BUCKET_NAME: str(process.env.S3_BUCKET_NAME),
    CLOUDFRONT_URL: str(process.env.CLOUDFRONT_URL), // CDN for uploaded files

    // Stripe (optional - for fiat payments)
    STRIPE_SECRET_KEY: str(process.env.STRIPE_SECRET_KEY),
    STRIPE_WEBHOOK_SECRET: str(process.env.STRIPE_WEBHOOK_SECRET),

    // BullBoard Admin (optional - basic auth for job queue dashboard)
    BULL_BOARD_USERNAME: str(process.env.BULL_BOARD_USERNAME),
    BULL_BOARD_PASSWORD: str(process.env.BULL_BOARD_PASSWORD),

    // Logging (optional - defaults to 'info')
    // Levels: fatal, error, warn, log, info, success, debug, trace, verbose
    LOG_LEVEL: str(process.env.LOG_LEVEL) || 'info',

    // OpenTelemetry / BetterStack (optional - set via OTEL_* env vars)
    // OTEL_EXPORTER_OTLP_ENDPOINT - set automatically
    // OTEL_EXPORTER_OTLP_HEADERS - set automatically
    // OTEL_SERVICE_NAME - defaults to 'inixiative-api'

    // Helpers
    isDev: NODE_ENV === 'development',
    isProd: NODE_ENV === 'production',
    isTest: NODE_ENV === 'test',
  };
};

export const env = getEnv();
