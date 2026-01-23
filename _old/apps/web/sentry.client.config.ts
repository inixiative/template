import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_ENABLED === 'true') {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    
    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: 1.0,
    
    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,
    
    // Enable distributed tracing
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.httpClientIntegration({
        failedRequestStatusCodes: [[400, 599]],
        failedRequestTargets: [/^http:\/\/localhost:3001\/api/],
      }),
    ],
    
    // Additional options
    environment: process.env.ENVIRONMENT || "development",
    enabled: true,
    
    // Session tracking
    autoSessionTracking: true,
    
    // Release tracking
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  });
}