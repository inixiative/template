#!/usr/bin/env bun

/**
 * Truncate Webhook Subscriptions
 *
 * Clears all webhook subscriptions from the local database.
 * Used after cloning production data to prevent webhooks firing to prod URLs.
 *
 * Safety: Only runs in local/test environments.
 *
 * Usage:
 *   bun run db:truncate:webhooks
 */

import { db } from '@template/db';
import { LogScope, log } from '@template/shared/logger';

const truncateWebhookSubscriptions = async () => {
  const env = process.env.ENVIRONMENT || process.env.NODE_ENV;

  // Safety check - only run in local/test (explicit allowlist)
  if (env !== 'local' && env !== 'test') {
    log.error(`Cannot truncate webhooks in "${env}" environment. Only allowed in local/test.`, LogScope.db);
    process.exit(1);
  }

  log.info('Truncating webhook subscriptions...', LogScope.db);

  try {
    const result = await db.$executeRaw`
      TRUNCATE "WebhookSubscription" CASCADE;
    `;

    log.success(`Truncated webhook subscriptions (${result} affected)`, LogScope.db);
  } catch (error) {
    log.error('Failed to truncate webhook subscriptions:', LogScope.db);
    console.error(error);
    throw error;
  }
};

truncateWebhookSubscriptions()
  .then(() => process.exit(0))
  .catch((error) => {
    log.error('Truncate failed:', LogScope.db);
    console.error(error);
    process.exit(1);
  });
