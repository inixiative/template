import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_ENABLED === 'true') {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    
    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: 1.0,
    
    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,
    
    // Additional options
    environment: process.env.ENVIRONMENT || "development",
    enabled: true,
    
    // Release tracking
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  });
}