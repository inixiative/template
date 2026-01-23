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
    PORT: Number(process.env.PORT) || 3000,
    DATABASE_URL: process.env.DATABASE_URL || '',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

    // Auth
    JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

    // CORS
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',

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
