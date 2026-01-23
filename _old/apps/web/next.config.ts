import type { NextConfig } from "next";

const sentryEnabled = process.env.SENTRY_ENABLED === 'true';

const nextConfig: NextConfig = {
  experimental: {
    cssChunking: true,
  },
  transpilePackages: ['@tailwindcss/postcss'],
  webpack: (config, { isServer }) => {
    if (!sentryEnabled) {
      // Ignore Sentry and OpenTelemetry when disabled
      config.resolve.alias['@sentry/nextjs'] = false;
      config.resolve.alias['@sentry/node'] = false;
      config.resolve.alias['@opentelemetry/instrumentation'] = false;
    }
    return config;
  },
};

let exportedConfig = nextConfig;

if (sentryEnabled) {
  try {
    const { withSentryConfig } = require("@sentry/nextjs");
    exportedConfig = withSentryConfig(
      nextConfig,
      {
        // For all available options, see:
        // https://github.com/getsentry/sentry-webpack-plugin#options

        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,

        // Only print logs for uploading source maps in CI
        silent: !process.env.CI,

        // For all available options, see:
        // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

        // Upload a larger set of source maps for prettier stack traces (increases build time)
        widenClientFileUpload: true,

        // Automatically annotate React components to show their full name in breadcrumbs and session replay
        reactComponentAnnotation: {
          enabled: true,
        },

        // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
        // This can increase your server load as well as your hosting bill.
        // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
        // side errors will fail.
        tunnelRoute: "/monitoring",

        // Hides source maps from generated client bundles
        hideSourceMaps: true,

        // Automatically tree-shake Sentry logger statements to reduce bundle size
        disableLogger: true,

        // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
        // See the following for more information:
        // https://docs.sentry.io/product/crons/
        // https://vercel.com/docs/cron-jobs
        automaticVercelMonitors: true,
      }
    );
  } catch (e) {
    console.log('Sentry not available, using default config');
  }
}

export default exportedConfig;