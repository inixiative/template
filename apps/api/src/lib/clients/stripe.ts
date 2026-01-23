/**
 * Stripe Client
 *
 * Used for fiat payment processing (investment deposits, payouts).
 *
 * Required environment variables:
 * - STRIPE_SECRET_KEY
 * - STRIPE_WEBHOOK_SECRET (for webhook verification)
 */

import { env } from '@src/config/env';

// Lazy-loaded client
let _stripeClient: Awaited<ReturnType<typeof createStripeClient>> | null = null;

export async function createStripeClient() {
  const Stripe = (await import('stripe')).default;

  return new Stripe(env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-12-18.acacia',
    typescript: true,
  });
}

export async function getStripeClient() {
  if (!_stripeClient) {
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }
    _stripeClient = await createStripeClient();
  }
  return _stripeClient;
}

// Re-export types
export type { Stripe } from 'stripe';
